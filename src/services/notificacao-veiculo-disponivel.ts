import { CanalNotificacao, TipoNotificacao } from "@prisma/client";

import { VeiculoResponse } from "../repositories/contracts/veiculo.contract.js";
import { IGaragemRepository } from "../repositories/garagem.repository.js";
import { IInteresseVeiculoRepository } from "../repositories/interesse.repository.js";
import { ILocadorRepository } from "../repositories/locador.repository.js";
import { INotificacaoInteresseRepository } from "../repositories/notificacao-interesse.repository.js";
import { IPreferenciaChecker } from "../repositories/preferencia-notificacao.repository.js";
import { IMailProvider } from "../infra/email/mail-provider.js";
import { VeiculoDisponivelPayload } from "./contracts/veiculo-disponivel.js";
import { renderVeiculoDisponivel } from "../templates/veiculo-disponivel.template.js";

export interface IVeiculoDisponivelNotifier {
  notificarVeiculoDisponivel(veiculo: VeiculoResponse): Promise<void>;
}

export class NotificacaoVeiculoDisponivelService
  implements IVeiculoDisponivelNotifier
{
  constructor(
    private readonly interesseRepository: IInteresseVeiculoRepository,
    private readonly notificacaoInteresseRepository: INotificacaoInteresseRepository,
    private readonly locadorRepository: ILocadorRepository,
    private readonly garagemRepository: IGaragemRepository,
    private readonly mailProvider: IMailProvider,
    private readonly preferenciaChecker?: IPreferenciaChecker,
  ) {}

  async notificarVeiculoDisponivel(veiculo: VeiculoResponse): Promise<void> {
    try {
      const interessados = await this.interesseRepository.findAtivosByVeiculo(
        veiculo.id,
      );
      if (interessados.length === 0) {
        return;
      }

      const locador = await this.locadorRepository.findById(veiculo.idLocador);
      const garagem = veiculo.garagemId
        ? await this.garagemRepository.findById(veiculo.garagemId)
        : null;

      const base: Omit<VeiculoDisponivelPayload, "locatario"> = {
        veiculo: {
          marca: veiculo.modeloVeiculo.marca,
          modelo: veiculo.modeloVeiculo.modelo,
          ano: veiculo.modeloVeiculo.ano,
          placa: veiculo.placa,
        },
        locador: {
          empresa: locador?.empresa ?? "Não informado",
        },
        garagem: garagem
          ? { nome: garagem.nome, endereco: garagem.endereco }
          : null,
      };

      for (const interessado of interessados) {
        if (!this.mailProvider.isEnabled()) {
          await this.notificarInternamente(base, interessado.id, {
            nome: interessado.locatario.nome,
            email: interessado.locatario.email,
          });
          continue;
        }

        if (
          this.preferenciaChecker &&
          !(await this.preferenciaChecker.estaHabilitada(
            interessado.idLocatario,
            CanalNotificacao.EMAIL,
            TipoNotificacao.VEICULO_DISPONIVEL,
          ))
        ) {
          console.info(
            `[interesse] locatário optou por não receber disponibilidade — inscrição ${interessado.id} (pulado)`,
          );
          continue;
        }

        await this.notificarInteressado(base, interessado.id, {
          nome: interessado.locatario.nome,
          email: interessado.locatario.email,
        });
      }
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      console.error(
        `[interesse] erro ao processar notificações — veículo ${veiculo.id}: ${mensagem}`,
      );
    }
  }

  private async notificarInternamente(
    base: Omit<VeiculoDisponivelPayload, "locatario">,
    idInteresse: string,
    locatario: { nome: string; email: string },
  ): Promise<void> {
    try {
      const content = renderVeiculoDisponivel({ ...base, locatario });
      const registro = await this.notificacaoInteresseRepository.registrar({
        idInteresse,
        destinatario: locatario.email,
        assunto: content.subject,
        canal: "INTERNA",
      });
      await this.notificacaoInteresseRepository.marcarEnviada(
        registro.id,
        new Date(),
      );
      await this.interesseRepository.marcarNotificado(idInteresse, new Date());
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      console.error(
        `[interesse] erro ao registrar aviso interno — inscrição ${idInteresse}: ${mensagem}`,
      );
    }
  }

  private async notificarInteressado(
    base: Omit<VeiculoDisponivelPayload, "locatario">,
    idInteresse: string,
    locatario: { nome: string; email: string },
  ): Promise<void> {
    try {
      const content = renderVeiculoDisponivel({ ...base, locatario });

      const registro = await this.notificacaoInteresseRepository.registrar({
        idInteresse,
        destinatario: locatario.email,
        assunto: content.subject,
      });

      try {
        await this.mailProvider.send({
          to: locatario.email,
          subject: content.subject,
          html: content.html,
          text: content.text,
        });
        await this.notificacaoInteresseRepository.marcarEnviada(
          registro.id,
          new Date(),
        );
        await this.interesseRepository.marcarNotificado(
          idInteresse,
          new Date(),
        );
        console.info(
          `[interesse] notificação enviada — inscrição ${idInteresse}`,
        );
      } catch (sendError) {
        const mensagem =
          sendError instanceof Error ? sendError.message : String(sendError);
        await this.notificacaoInteresseRepository.marcarFalha(
          registro.id,
          mensagem,
        );
        console.error(
          `[interesse] falha ao enviar — inscrição ${idInteresse}: ${mensagem}`,
        );
      }
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      console.error(
        `[interesse] erro ao processar inscrição ${idInteresse}: ${mensagem}`,
      );
    }
  }
}

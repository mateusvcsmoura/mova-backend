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

// Contrato mínimo do qual a regra de negócio do veículo depende. Mantém o
// VeiculoService desacoplado da implementação concreta de notificação/e-mail —
// novos canais entram como outras implementações deste contrato (ou novos
// providers atrás do dispatcher), sem alterar o fluxo de status do veículo.
export interface IVeiculoDisponivelNotifier {
  notificarVeiculoDisponivel(veiculo: VeiculoResponse): Promise<void>;
}

// Orquestra o disparo das notificações de disponibilidade:
//   localiza inscrições ATIVAS -> monta o payload -> gera o template ->
//   registra a tentativa -> envia -> atualiza o registro (sucesso/falha) ->
//   encerra a inscrição (NOTIFICADO) quando o envio foi aceito.
//
// É a fronteira de tratamento de erros: NUNCA lança. Qualquer falha (SMTP
// indisponível, provedor recusando, erro ao montar payload) é registrada e
// logada, mas não propaga — a atualização do veículo já concluída não pode ser
// afetada pelo envio. A falha em um destinatário não interrompe os demais.
export class NotificacaoVeiculoDisponivelService
  implements IVeiculoDisponivelNotifier
{
  constructor(
    private readonly interesseRepository: IInteresseVeiculoRepository,
    private readonly notificacaoInteresseRepository: INotificacaoInteresseRepository,
    private readonly locadorRepository: ILocadorRepository,
    private readonly garagemRepository: IGaragemRepository,
    private readonly mailProvider: IMailProvider,
    // RN11: opcional. Quando presente, respeita o opt-out de cada locatário
    // para VEICULO_DISPONIVEL. Ausente (testes antigos) mantém o envio.
    private readonly preferenciaChecker?: IPreferenciaChecker,
  ) {}

  async notificarVeiculoDisponivel(veiculo: VeiculoResponse): Promise<void> {
    // Sem provedor configurado (dev/testes): não tenta enviar nem registra.
    if (!this.mailProvider.isEnabled()) {
      console.info(
        `[interesse] envio desabilitado (SMTP não configurado) — veículo ${veiculo.id}`,
      );
      return;
    }

    try {
      const interessados = await this.interesseRepository.findAtivosByVeiculo(
        veiculo.id,
      );
      if (interessados.length === 0) {
        return;
      }

      // Dados compartilhados por todos os destinatários — resolvidos uma única
      // vez por disparo (não por interessado).
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
        // RN11: opt-out de um locatário pula apenas aquele destinatário; os
        // demais continuam recebendo. A inscrição permanece ATIVA.
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
      // Falha fora do envio individual (consulta das inscrições etc.). Loga e
      // segue — a atualização do veículo não é afetada.
      const mensagem = error instanceof Error ? error.message : String(error);
      console.error(
        `[interesse] erro ao processar notificações — veículo ${veiculo.id}: ${mensagem}`,
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

      // Registra a tentativa (PENDENTE) antes de enviar — auditoria mesmo que
      // o processo caia no meio do envio.
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
        // Envio aceito: encerra a inscrição para não notificar duas vezes o
        // mesmo evento. Nova disponibilidade exige nova inscrição (reativação).
        await this.interesseRepository.marcarNotificado(
          idInteresse,
          new Date(),
        );
        console.info(
          `[interesse] notificação enviada — inscrição ${idInteresse} -> ${locatario.email}`,
        );
      } catch (sendError) {
        const mensagem =
          sendError instanceof Error ? sendError.message : String(sendError);
        // A inscrição permanece ATIVA: uma próxima transição para DISPONIVEL
        // tentará notificar novamente.
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

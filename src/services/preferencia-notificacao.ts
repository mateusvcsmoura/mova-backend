import { CanalNotificacao, Cargo, TipoNotificacao } from "@prisma/client";

import { HttpError } from "../errors/HttpError.js";
import {
  IPreferenciaNotificacaoRepository,
  PreferenciaNotificacaoResponse,
} from "../repositories/preferencia-notificacao.repository.js";

interface Autor {
  id: string;
  cargo: Cargo;
}

// Preferências de notificação do usuário (opt-in/opt-out por canal x tipo).
export class PreferenciaNotificacaoService {
  constructor(
    private readonly repository: IPreferenciaNotificacaoRepository,
  ) {}

  private assertAcesso(idConta: string, autor: Autor): void {
    if (autor.cargo !== Cargo.ADMIN && autor.id !== idConta) {
      throw new HttpError(403, "Acesso negado");
    }
  }

  listar = async (
    idConta: string,
    autor: Autor,
  ): Promise<PreferenciaNotificacaoResponse[]> => {
    this.assertAcesso(idConta, autor);
    return this.repository.listarPorConta(idConta);
  };

  definir = async (
    idConta: string,
    autor: Autor,
    dados: {
      canal: CanalNotificacao;
      tipo: TipoNotificacao;
      habilitado: boolean;
    },
  ): Promise<PreferenciaNotificacaoResponse> => {
    this.assertAcesso(idConta, autor);
    return this.repository.definir({ idConta, ...dados });
  };
}

import { CanalNotificacao, TipoNotificacao } from "@prisma/client";

export interface PreferenciaNotificacaoResponse {
  id: string;
  idConta: string;
  canal: CanalNotificacao;
  tipo: TipoNotificacao;
  habilitado: boolean;
  atualizadoEm: Date;
}

export interface DefinirPreferenciaInput {
  idConta: string;
  canal: CanalNotificacao;
  tipo: TipoNotificacao;
  habilitado: boolean;
}

// Consulta usada pelos notificadores para respeitar o opt-out. Interface enxuta
// para que os notificadores dependam só disto (não do repositório inteiro).
export interface IPreferenciaChecker {
  // Habilitado por padrão (opt-in): ausência de preferência = true.
  estaHabilitada(
    idConta: string,
    canal: CanalNotificacao,
    tipo: TipoNotificacao,
  ): Promise<boolean>;
}

export interface IPreferenciaNotificacaoRepository extends IPreferenciaChecker {
  listarPorConta(idConta: string): Promise<PreferenciaNotificacaoResponse[]>;
  // Upsert por (idConta, canal, tipo).
  definir(
    input: DefinirPreferenciaInput,
  ): Promise<PreferenciaNotificacaoResponse>;
}

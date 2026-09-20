import {
  CompartilhamentoAtivo,
  CompartilhamentoPublico,
} from "./contracts/compartilhamento.contract.js";

export interface ICompartilhamentoReservaRepository {
  criarOuObterAtivo(
    idReserva: string,
    gerarToken: () => string,
  ): Promise<{ compartilhamento: CompartilhamentoAtivo; criado: boolean }>;
  revogar(idReserva: string): Promise<boolean>;
  findPublicoByToken(token: string): Promise<CompartilhamentoPublico | null>;
}

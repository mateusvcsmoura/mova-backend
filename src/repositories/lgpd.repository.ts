import { AcaoLgpd, Cargo } from "@prisma/client";

// Snapshot dos dados pessoais de um titular (portabilidade LGPD). Só campos
// pessoais + registros vinculados; nunca senhaHash.
export interface DadosPessoaisExport {
  conta: {
    id: string;
    nome: string;
    email: string;
    telefone: string | null;
    cargo: Cargo;
    cep: string;
    endereco: string;
    criadaEm: Date;
    anonimizadoEm: Date | null;
  };
  locatario: {
    cpf: string;
    cnh: string;
    rg: string;
    dataNascimento: Date;
  } | null;
  locador: {
    empresa: string;
    cnpj: string;
  } | null;
  reservas: Array<{
    id: string;
    dataHoraInicio: Date;
    dataHoraFim: Date;
    status: string;
    statusPagamento: string;
    valorTotal: number;
    criadaEm: Date;
  }>;
}

export interface AcessoDadoPessoalResponse {
  id: string;
  idTitular: string;
  idAutor: string;
  acao: AcaoLgpd;
  detalhe: string | null;
  criadoEm: Date;
}

export interface RegistrarAcessoInput {
  idTitular: string;
  idAutor: string;
  acao: AcaoLgpd;
  detalhe?: string;
}

export interface ILgpdRepository {
  // Exporta os dados pessoais do titular (null se a conta não existe).
  exportarDadosPessoais(idConta: string): Promise<DadosPessoaisExport | null>;
  // Anonimiza PII da conta e do perfil (locatário/locador), mantendo as linhas
  // e o histórico de negócio. Idempotente. Retorna false se a conta não existe.
  anonimizarConta(idConta: string): Promise<boolean>;
  // Auditoria de acesso a dados pessoais.
  registrarAcesso(input: RegistrarAcessoInput): Promise<void>;
  listarAcessos(idTitular: string): Promise<AcessoDadoPessoalResponse[]>;
}

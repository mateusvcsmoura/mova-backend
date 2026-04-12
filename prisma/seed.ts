import { prisma } from "../src/database/prisma.js";

interface DeficienciaData {
  descricao: string;
}

interface LocatarioData {
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  cnh: string;
  deficienciaId?: string;
}

interface LocadorData {
  nome: string;
  email: string;
  telefone: string;
  empresa: string;
  cnpj: string;
}

interface GaragemData {
  nome: string;
  endereco: string;
  capacidade: number;
  acessibilidade: boolean;
  locadorId: string;
}

interface VeiculoData {
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  cambio: string;
  capacidade: number;
  status: "DISPONIVEL" | "RESERVADO" | "MANUTENCAO" | "INATIVO";
  eletrico: boolean;
  adaptado: boolean;
  locadorId: string;
  garagemId?: string;
}

interface LocalizacaoData {
  latitude: string;
  longitude: string;
  veiculoId: string;
}

interface ReservaData {
  veiculoId: string;
  locatarioId: string;
  diasOffset: number;
  duracao: number;
  valorTotal: string;
  status:
    | "AGUARDANDO_PAGAMENTO"
    | "CONFIRMADA"
    | "EM_ANDAMENTO"
    | "REALIZADA"
    | "CANCELADA";
  statusPagamento: "AGUARDANDO_PAGAMENTO" | "PROCESSANDO" | "SUCESSO" | "FALHA";
}

interface AvaliacaoData {
  reservaId: string;
  nota: string;
  comentario?: string;
}

// ========== DADOS ==========
const deficienciasData: DeficienciaData[] = [
  { descricao: "Deficiência de mobilidade" },
  { descricao: "Deficiência visual" },
  { descricao: "Deficiência auditiva" },
  { descricao: "Deficiência intelectual" },
  { descricao: "Deficiência motora" },
];

const locadoresData: LocadorData[] = [
  {
    nome: "AutoRent São Paulo",
    email: "contato@autorent.com",
    telefone: "1133333333",
    empresa: "AutoRent LTDA",
    cnpj: "12345678000190",
  },
  {
    nome: "EcoMovel RJ",
    email: "contato@ecomove.com",
    telefone: "2144444444",
    empresa: "EcoMovel Ltda",
    cnpj: "98765432000109",
  },
  {
    nome: "VeiculoMax MG",
    email: "contato@veiculomax.com",
    telefone: "3155555555",
    empresa: "VeiculoMax Locações",
    cnpj: "11111111000100",
  },
  {
    nome: "Rodas Livres BA",
    email: "contato@rodaslivres.com",
    telefone: "7166666666",
    empresa: "Rodas Livres Ltda",
    cnpj: "22222222000200",
  },
  {
    nome: "DriveOn RS",
    email: "contato@driveon.com",
    telefone: "5177777777",
    empresa: "DriveOn Aluguel de Veículos",
    cnpj: "33333333000300",
  },
];

// ========== FUNÇÕES ==========

async function main() {
  console.log("🌱 Iniciando seed do banco de dados...\n");

  // 1. Criar Deficiências
  console.log("📋 Criando deficiências...");
  const deficiencias: string[] = [];
  for (const data of deficienciasData) {
    const deficiencia = await prisma.deficiencia.create({ data });
    deficiencias.push(deficiencia.id);
  }
  console.log(`✓ ${deficiencias.length} deficiências criadas\n`);

  // 2. Criar Locadores e suas Contas
  console.log("🏢 Criando locadores...");
  const locadores: Array<{ id: string; contaId: string }> = [];
  for (const data of locadoresData) {
    const conta = await prisma.conta.create({
      data: {
        nome: data.nome,
        email: data.email,
        telefone: data.telefone,
        senhaHash: "$2b$10$abcdefghijklmnopqrstuvwxyz123456789",
        cep: "01001000",
        endereco: "Endereço do locador",
        locador: {
          create: {
            empresa: data.empresa,
            cnpj: data.cnpj,
          },
        },
      },
      include: {
        locador: true,
      },
    });
    locadores.push({
      id: conta.locador?.id || conta.id,
      contaId: conta.id,
    });
  }
  console.log(`✓ ${locadores.length} locadores criados\n`);

  // 3. Criar Garagens baseado nos locadores
  console.log("🏗️  Criando garagens...");
  const garagens: string[] = [];

  const garagensLocador0: GaragemData[] = [
    {
      nome: "Garagem Centro - SP",
      endereco: "Av. Paulista, 1000 - São Paulo/SP",
      capacidade: 50,
      acessibilidade: true,
      locadorId: locadores[0].id,
    },
    {
      nome: "Garagem Zona Norte - SP",
      endereco: "Av. Tiradentes, 500 - São Paulo/SP",
      capacidade: 30,
      acessibilidade: true,
      locadorId: locadores[0].id,
    },
  ];

  const garagensLocador1: GaragemData[] = [
    {
      nome: "Garagem Centro - RJ",
      endereco: "Av. Rio Branco, 100 - Rio de Janeiro/RJ",
      capacidade: 40,
      acessibilidade: true,
      locadorId: locadores[1].id,
    },
    {
      nome: "Garagem Copacabana - RJ",
      endereco: "Av. Atlântica, 2000 - Rio de Janeiro/RJ",
      capacidade: 35,
      acessibilidade: true,
      locadorId: locadores[1].id,
    },
  ];

  const garagensLocador2: GaragemData[] = [
    {
      nome: "Garagem Savassi - MG",
      endereco: "Rua Savassi, 500 - Belo Horizonte/MG",
      capacidade: 25,
      acessibilidade: true,
      locadorId: locadores[2].id,
    },
  ];

  const garagensLocador3: GaragemData[] = [
    {
      nome: "Garagem Centro Histórico - BA",
      endereco: "Rua Chile, 100 - Salvador/BA",
      capacidade: 45,
      acessibilidade: true,
      locadorId: locadores[3].id,
    },
  ];

  const garagensLocador4: GaragemData[] = [
    {
      nome: "Garagem Moinhos - RS",
      endereco: "Av. Moinhos de Vento, 300 - Porto Alegre/RS",
      capacidade: 38,
      acessibilidade: true,
      locadorId: locadores[4].id,
    },
  ];

  const todasGaragens = [
    ...garagensLocador0,
    ...garagensLocador1,
    ...garagensLocador2,
    ...garagensLocador3,
    ...garagensLocador4,
  ];

  for (const data of todasGaragens) {
    const garagem = await prisma.garagem.create({
      data: {
        idLocador: data.locadorId,
        nome: data.nome,
        endereco: data.endereco,
        capacidade: data.capacidade,
        veiculosAlocados: 0,
        acessibilidade: data.acessibilidade,
      },
    });
    garagens.push(garagem.id);
  }
  console.log(`✓ ${garagens.length} garagens criadas\n`);

  // 4. Criar Veículos baseado nos locadores e garagens
  console.log("🚗 Criando veículos...");
  const veiculos: string[] = [];

  const veiculosLocador0: VeiculoData[] = [
    {
      placa: "ABC1234",
      marca: "Honda",
      modelo: "Civic",
      ano: 2023,
      cambio: "Automático",
      capacidade: 5,
      status: "DISPONIVEL",
      eletrico: false,
      adaptado: true,
      locadorId: locadores[0].id,
      garagemId: garagens[0],
    },
    {
      placa: "DEF5678",
      marca: "Toyota",
      modelo: "Corolla",
      ano: 2023,
      cambio: "Automático",
      capacidade: 5,
      status: "DISPONIVEL",
      eletrico: false,
      adaptado: false,
      locadorId: locadores[0].id,
      garagemId: garagens[0],
    },
  ];

  const veiculosLocador1: VeiculoData[] = [
    {
      placa: "GHI9012",
      marca: "Tesla",
      modelo: "Model 3",
      ano: 2024,
      cambio: "Automático",
      capacidade: 5,
      status: "DISPONIVEL",
      eletrico: true,
      adaptado: true,
      locadorId: locadores[1].id,
      garagemId: garagens[2],
    },
  ];

  const veiculosLocador2: VeiculoData[] = [
    {
      placa: "MNO7890",
      marca: "Volkswagen",
      modelo: "Polo",
      ano: 2022,
      cambio: "Automático",
      capacidade: 5,
      status: "MANUTENCAO",
      eletrico: false,
      adaptado: true,
      locadorId: locadores[2].id,
      garagemId: garagens[4],
    },
  ];

  const veiculosLocador3: VeiculoData[] = [
    {
      placa: "PQR1234",
      marca: "Chevrolet",
      modelo: "Onix",
      ano: 2023,
      cambio: "Automático",
      capacidade: 5,
      status: "DISPONIVEL",
      eletrico: false,
      adaptado: false,
      locadorId: locadores[3].id,
      garagemId: garagens[5],
    },
  ];

  const veiculosLocador4: VeiculoData[] = [
    {
      placa: "STU5678",
      marca: "Fiat",
      modelo: "Argo",
      ano: 2023,
      cambio: "Manual",
      capacidade: 5,
      status: "RESERVADO",
      eletrico: false,
      adaptado: false,
      locadorId: locadores[4].id,
      garagemId: garagens[6],
    },
  ];

  const todosVeiculos = [
    ...veiculosLocador0,
    ...veiculosLocador1,
    ...veiculosLocador2,
    ...veiculosLocador3,
    ...veiculosLocador4,
  ];

  for (const data of todosVeiculos) {
    const veiculo = await prisma.veiculo.create({
      data: {
        idLocador: data.locadorId,
        garagemId: data.garagemId,
        placa: data.placa,
        marca: data.marca,
        modelo: data.modelo,
        ano: data.ano,
        cambio: data.cambio,
        capacidade: data.capacidade,
        status: data.status,
        eletrico: data.eletrico,
        adaptado: data.adaptado,
      },
    });
    veiculos.push(veiculo.id);
  }
  console.log(`✓ ${veiculos.length} veículos criados\n`);

  // 5. Criar Localizações baseado nos veículos
  console.log("📍 Criando localizações...");
  const localizacoes: string[] = [];

  const localizacoesData: LocalizacaoData[] = [
    {
      latitude: "-23.5505",
      longitude: "-46.6333",
      veiculoId: veiculos[0],
    },
    {
      latitude: "-22.9068",
      longitude: "-43.1729",
      veiculoId: veiculos[2],
    },
    {
      latitude: "-19.9167",
      longitude: "-43.9345",
      veiculoId: veiculos[3],
    },
    {
      latitude: "-12.9714",
      longitude: "-38.5014",
      veiculoId: veiculos[3],
    },
    {
      latitude: "-30.0277",
      longitude: "-51.2197",
      veiculoId: veiculos[4],
    },
  ];

  for (const data of localizacoesData) {
    const localizacao = await prisma.localizacao.create({
      data: {
        idVeiculo: data.veiculoId,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });
    localizacoes.push(localizacao.id);
  }
  console.log(`✓ ${localizacoes.length} localizações criadas\n`);

  // 6. Criar Locatários baseado nas deficiências
  console.log("👤 Criando locatários...");
  const locatarios: string[] = [];

  const locatariosData: LocatarioData[] = [
    {
      nome: "Carlos Santos",
      email: "carlos.santos@example.com",
      telefone: "11999991111",
      cpf: "12345678901",
      cnh: "12345678901234567",
      deficienciaId: deficiencias[0],
    },
    {
      nome: "Maria Oliveira",
      email: "maria.oliveira@example.com",
      telefone: "11999992222",
      cpf: "98765432109",
      cnh: "98765432109876543",
      deficienciaId: deficiencias[1],
    },
    {
      nome: "João Pedro",
      email: "joao.pedro@example.com",
      telefone: "21999993333",
      cpf: "55555555555",
      cnh: "55555555555555555",
      deficienciaId: deficiencias[2],
    },
    {
      nome: "Ana Silva",
      email: "ana.silva@example.com",
      telefone: "31999994444",
      cpf: "66666666666",
      cnh: "66666666666666666",
      deficienciaId: deficiencias[3],
    },
    {
      nome: "Roberto Costa",
      email: "roberto.costa@example.com",
      telefone: "41999995555",
      cpf: "77777777777",
      cnh: "77777777777777777",
      deficienciaId: deficiencias[4],
    },
  ];

  for (const data of locatariosData) {
    const conta = await prisma.conta.create({
      data: {
        nome: data.nome,
        email: data.email,
        telefone: data.telefone,
        senhaHash: "$2b$10$abcdefghijklmnopqrstuvwxyz123456789",
        cep: "02002000",
        endereco: "Endereço do locatário",
        locatario: {
          create: {
            cpf: data.cpf,
            cnh: data.cnh,
            deficienciaId: data.deficienciaId,
          },
        },
      },
      include: {
        locatario: true,
      },
    });
    locatarios.push(conta.locatario?.id || conta.id);
  }
  console.log(`✓ ${locatarios.length} locatários criados\n`);

  // 7. Criar Reservas baseado em veículos e locatários
  console.log("📅 Criando reservas...");
  const reservas: string[] = [];

  const reservasData: ReservaData[] = [
    {
      veiculoId: veiculos[0],
      locatarioId: locatarios[0],
      diasOffset: 1,
      duracao: 2,
      valorTotal: "450.50",
      status: "CONFIRMADA",
      statusPagamento: "SUCESSO",
    },
    {
      veiculoId: veiculos[2],
      locatarioId: locatarios[1],
      diasOffset: 5,
      duracao: 3,
      valorTotal: "600.00",
      status: "AGUARDANDO_PAGAMENTO",
      statusPagamento: "AGUARDANDO_PAGAMENTO",
    },
    {
      veiculoId: veiculos[1],
      locatarioId: locatarios[2],
      diasOffset: 10,
      duracao: 1,
      valorTotal: "350.00",
      status: "EM_ANDAMENTO",
      statusPagamento: "SUCESSO",
    },
    {
      veiculoId: veiculos[3],
      locatarioId: locatarios[3],
      diasOffset: 15,
      duracao: 4,
      valorTotal: "800.00",
      status: "REALIZADA",
      statusPagamento: "SUCESSO",
    },
    {
      veiculoId: veiculos[4],
      locatarioId: locatarios[4],
      diasOffset: 20,
      duracao: 2,
      valorTotal: "500.00",
      status: "CANCELADA",
      statusPagamento: "FALHA",
    },
  ];

  for (const data of reservasData) {
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() + data.diasOffset);

    const dataFim = new Date(dataInicio);
    dataFim.setDate(dataFim.getDate() + data.duracao);

    const reserva = await prisma.reserva.create({
      data: {
        idVeiculo: data.veiculoId,
        idLocatario: data.locatarioId,
        dataHoraInicio: dataInicio,
        dataHoraFim: dataFim,
        valorTotal: data.valorTotal,
        status: data.status,
        statusPagamento: data.statusPagamento,
      },
    });
    reservas.push(reserva.id);
  }
  console.log(`✓ ${reservas.length} reservas criadas\n`);

  // 8. Criar Avaliações baseado em reservas
  console.log("⭐ Criando avaliações...");
  const avaliacoes: string[] = [];

  const avaliacoesData: AvaliacaoData[] = [
    {
      reservaId: reservas[0],
      nota: "4.5",
      comentario: "Veículo em ótimas condições, gostei muito da experiência!",
    },
    {
      reservaId: reservas[1],
      nota: "5.0",
      comentario: "Perfeito! Atendimento excelente!",
    },
    {
      reservaId: reservas[2],
      nota: "4.0",
      comentario: "Bom custo-benefício, recomendo!",
    },
    {
      reservaId: reservas[3],
      nota: "3.5",
      comentario: "Veículo ok, mas teve pequeno amassado.",
    },
  ];

  for (const data of avaliacoesData) {
    const avaliacao = await prisma.avaliacao.create({
      data: {
        idReserva: data.reservaId,
        nota: data.nota,
        comentario: data.comentario,
      },
    });
    avaliacoes.push(avaliacao.id);
  }
  console.log(`✓ ${avaliacoes.length} avaliações criadas\n`);

  console.log("✨ Seed concluído com sucesso!");
  console.log("\n📊 Resumo dos dados criados:");
  console.log(`  - ${deficiencias.length} Deficiências`);
  console.log(`  - ${locadores.length} Locadores`);
  console.log(`  - ${garagens.length} Garagens`);
  console.log(`  - ${veiculos.length} Veículos`);
  console.log(`  - ${localizacoes.length} Localizações`);
  console.log(`  - ${locatarios.length} Locatários`);
  console.log(`  - ${reservas.length} Reservas`);
  console.log(`  - ${avaliacoes.length} Avaliações`);
}

main()
  .catch((e) => {
    console.error("❌ Erro ao executar seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

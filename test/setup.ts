import { beforeAll, beforeEach } from "vitest";
import { prisma } from "../src/database/prisma";

beforeAll(async () => {
  await prisma.reserva.deleteMany();
  await prisma.conta.deleteMany();
});

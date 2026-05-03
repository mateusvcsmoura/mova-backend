import { beforeEach } from "vitest";
import { prisma } from "../src/database/prisma";

beforeEach(async () => {
  await prisma.reserva.deleteMany();
  await prisma.conta.deleteMany();
});

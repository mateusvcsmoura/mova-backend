import { beforeEach } from "vitest";
import { prisma } from "../src/database/prisma";

beforeEach(async () => {
  await prisma.conta.deleteMany();
});

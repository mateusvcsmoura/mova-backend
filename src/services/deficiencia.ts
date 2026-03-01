import { HttpError } from "../errors/HttpError.js";
import {
  CreateDeficienciaRequest,
  UpdateDeficienciaRequest,
} from "../repositories/contracts/deficiencia.contract.js";
import { DeficienciaRepository } from "../repositories/deficiencia.repository.js";

export class DeficienciaService {
  constructor(private readonly deficienciaRepository: DeficienciaRepository) {}

  async findAll() {
    return await this.deficienciaRepository.findAll();
  }

  async findById(id: string) {
    const deficiencia = await this.deficienciaRepository.findById(id);

    if (!deficiencia) {
      throw new Error("Deficiência não encontrada");
    }

    return deficiencia;
  }

  async findByDescription(description: string) {
    const deficiencia =
      await this.deficienciaRepository.findByDescription(description);

    if (!deficiencia) {
      throw new Error("Deficiência não encontrada");
    }

    return deficiencia;
  }

  async create(data: CreateDeficienciaRequest) {
    const existingDeficiencia =
      await this.deficienciaRepository.findByDescription(data.descricao);

    if (existingDeficiencia) {
      throw new HttpError(409, "Deficiência já existe");
    }

    return await this.deficienciaRepository.create(data);
  }

  async update(id: string, data: UpdateDeficienciaRequest) {
    const existingDeficiencia = await this.deficienciaRepository.findById(id);

    if (!existingDeficiencia) {
      throw new HttpError(404, "Deficiência não encontrada");
    }

    return await this.deficienciaRepository.update(id, data);
  }

  async delete(id: string) {
    const existingDeficiencia = await this.deficienciaRepository.findById(id);

    if (!existingDeficiencia) {
      throw new HttpError(404, "Deficiência não encontrada");
    }

    await this.deficienciaRepository.delete(id);
  }
}

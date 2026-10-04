// Catálogo de mensagens de negócio (HttpError sem code) por texto pt-BR exato.
// Usado pelo error-handler só quando locale !== "pt"; em pt a mensagem original
// sai intacta. Mensagem ausente aqui cai no texto original (fallback seguro).
// test/i18n/mensagens-catalogo.test.ts varre src/ e falha se um literal novo de
// `new HttpError(` não tiver entrada.

import type { Locale } from "./index.js";

type Traducao = { en: string; es: string };

export const MENSAGENS: Record<string, Traducao> = {
  // Genéricas / requisição
  "Acesso negado": { en: "Access denied", es: "Acceso denegado" },
  "Não autenticado": { en: "Not authenticated", es: "No autenticado" },
  "Token inválido": { en: "Invalid token", es: "Token inválido" },
  "Token inválido ou expirado": { en: "Invalid or expired token", es: "Token inválido o expirado" },
  "Credenciais inválidas": { en: "Invalid credentials", es: "Credenciales inválidas" },
  "Senha atual incorreta": { en: "Current password is incorrect", es: "La contraseña actual es incorrecta" },
  "Sessão revogada porque a conta foi anonimizada": {
    en: "Session revoked because the account was anonymized",
    es: "Sesión revocada porque la cuenta fue anonimizada",
  },
  "Sessão revogada porque a conta não existe mais": {
    en: "Session revoked because the account no longer exists",
    es: "Sesión revocada porque la cuenta ya no existe",
  },
  "Rota da API não encontrada.": { en: "API route not found.", es: "Ruta de la API no encontrada." },
  "Corpo da requisição ausente": { en: "Request body missing", es: "Falta el cuerpo de la solicitud" },
  "Parâmetros ausentes": { en: "Missing parameters", es: "Faltan parámetros" },
  "Parâmetros de consulta ausentes": { en: "Missing query parameters", es: "Faltan parámetros de consulta" },
  "Parâmetros ou corpo da requisição ausentes": {
    en: "Missing parameters or request body",
    es: "Faltan parámetros o el cuerpo de la solicitud",
  },
  "Nenhum campo enviado para atualização.": { en: "No fields sent for update.", es: "No se enviaron campos para actualizar." },
  "Nenhum campo informado para atualização.": { en: "No fields provided for update.", es: "No se informaron campos para actualizar." },
  "ID inválido": { en: "Invalid ID", es: "ID inválido" },
  "ID da garagem inválido": { en: "Invalid garage ID", es: "ID de garaje inválido" },
  "ID do condutor inválido": { en: "Invalid driver ID", es: "ID de conductor inválido" },
  "ID do modelo inválido": { en: "Invalid model ID", es: "ID de modelo inválido" },
  "ID do veículo inválido": { en: "Invalid vehicle ID", es: "ID de vehículo inválido" },
  "ID do locador é obrigatório": { en: "Rental company ID is required", es: "El ID del arrendador es obligatorio" },
  "ID do locatário é obrigatório": { en: "Renter ID is required", es: "El ID del arrendatario es obligatorio" },
  "Status inválido": { en: "Invalid status", es: "Estado inválido" },
  "Descrição deve ser uma string": { en: "Description must be a string", es: "La descripción debe ser un texto" },
  "Latitude deve estar entre -90 e 90": { en: "Latitude must be between -90 and 90", es: "La latitud debe estar entre -90 y 90" },
  "Longitude deve estar entre -180 e 180": { en: "Longitude must be between -180 and 180", es: "La longitud debe estar entre -180 y 180" },

  // Conta / cadastro
  "Cargo ADMIN não pode ser usado no cadastro público": {
    en: "The ADMIN role cannot be used in public sign-up",
    es: "El rol ADMIN no puede usarse en el registro público",
  },
  "Conta não encontrada": { en: "Account not found", es: "Cuenta no encontrada" },
  "Email inválido ou não informado": { en: "Email is invalid or missing", es: "Correo electrónico inválido o no informado" },
  "Email já em uso": { en: "Email already in use", es: "El correo electrónico ya está en uso" },
  "Email já está em uso": { en: "Email is already in use", es: "El correo electrónico ya está en uso" },
  "A conta possui histórico de reservas e não pode ser excluída. Use a anonimização em POST /api/lgpd/anonimizar.": {
    en: "The account has booking history and cannot be deleted. Use anonymization at POST /api/lgpd/anonimizar.",
    es: "La cuenta tiene historial de reservas y no puede eliminarse. Use la anonimización en POST /api/lgpd/anonimizar.",
  },
  "Locador com este CNPJ ou empresa já existe": {
    en: "A rental company with this CNPJ or name already exists",
    es: "Ya existe un arrendador con este CNPJ o empresa",
  },
  "Locador não encontrado": { en: "Rental company not found", es: "Arrendador no encontrado" },
  "Nenhum locador encontrado para a empresa especificada": {
    en: "No rental company found for the specified company name",
    es: "No se encontró ningún arrendador para la empresa especificada",
  },
  "Locatário com este CPF ou CNH já existe": {
    en: "A renter with this CPF or driver's license already exists",
    es: "Ya existe un arrendatario con este CPF o licencia de conducir",
  },
  "Locatário não encontrado": { en: "Renter not found", es: "Arrendatario no encontrado" },
  "Locatário não encontrado.": { en: "Renter not found.", es: "Arrendatario no encontrado." },
  "Locatário da reserva não encontrado.": { en: "Booking renter not found.", es: "Arrendatario de la reserva no encontrado." },
  "Deficiência já existe": { en: "Disability already exists", es: "La discapacidad ya existe" },
  "Deficiência não encontrada": { en: "Disability not found", es: "Discapacidad no encontrada" },
  "Deficiência não encontrada.": { en: "Disability not found.", es: "Discapacidad no encontrada." },

  // Bloqueios
  "A data de expiração do bloqueio deve estar no futuro.": {
    en: "The block expiration date must be in the future.",
    es: "La fecha de expiración del bloqueo debe estar en el futuro.",
  },
  "Bloqueio já foi revogado.": { en: "Block has already been revoked.", es: "El bloqueo ya fue revocado." },
  "Bloqueio não encontrado": { en: "Block not found", es: "Bloqueo no encontrado" },
  "Bloqueio não encontrado.": { en: "Block not found.", es: "Bloqueo no encontrado." },
  "Existem pendências financeiras impeditivas. Regularize sua situação para realizar novas reservas.": {
    en: "There are outstanding financial issues. Settle them to make new bookings.",
    es: "Existen pendientes financieros que lo impiden. Regularice su situación para realizar nuevas reservas.",
  },
  "Sua conta está bloqueada por suspeita de fraude. Entre em contato com o suporte.": {
    en: "Your account is blocked due to suspected fraud. Please contact support.",
    es: "Su cuenta está bloqueada por sospecha de fraude. Póngase en contacto con soporte.",
  },
  "Sua conta está bloqueada por pendências de documentação. Regularize seus documentos para reservar.": {
    en: "Your account is blocked due to pending documentation. Update your documents to book.",
    es: "Su cuenta está bloqueada por documentación pendiente. Regularice sus documentos para reservar.",
  },
  "Sua conta está bloqueada por multas pendentes. Regularize-as para realizar novas reservas.": {
    en: "Your account is blocked due to unpaid fines. Pay them to make new bookings.",
    es: "Su cuenta está bloqueada por multas pendientes. Regularícelas para realizar nuevas reservas.",
  },
  "Sua conta está temporariamente bloqueada por decisão administrativa.": {
    en: "Your account is temporarily blocked by administrative decision.",
    es: "Su cuenta está bloqueada temporalmente por decisión administrativa.",
  },
  "Sua conta está bloqueada e não pode realizar novas reservas no momento.": {
    en: "Your account is blocked and cannot make new bookings at this time.",
    es: "Su cuenta está bloqueada y no puede realizar nuevas reservas en este momento.",
  },

  // Garagens
  "A capacidade não pode ser menor que a quantidade de veículos alocados.": {
    en: "Capacity cannot be lower than the number of allocated vehicles.",
    es: "La capacidad no puede ser menor que la cantidad de vehículos asignados.",
  },
  "A garagem já atingiu sua capacidade máxima.": { en: "The garage has reached its maximum capacity.", es: "El garaje alcanzó su capacidad máxima." },
  "A garagem não está disponível para nova alocação.": {
    en: "The garage is not available for new allocations.",
    es: "El garaje no está disponible para nuevas asignaciones.",
  },
  "A garagem precisa pertencer ao mesmo locador responsável pelo veículo": {
    en: "The garage must belong to the same rental company that owns the vehicle",
    es: "El garaje debe pertenecer al mismo arrendador responsable del vehículo",
  },
  "Apenas o locador responsável pode gerenciar veículos nesta garagem": {
    en: "Only the responsible rental company can manage vehicles in this garage",
    es: "Solo el arrendador responsable puede gestionar vehículos en este garaje",
  },
  "Garagem não encontrada": { en: "Garage not found", es: "Garaje no encontrado" },
  "Garagem não encontrada.": { en: "Garage not found.", es: "Garaje no encontrado." },
  "Garagem de devolução não encontrada.": { en: "Return garage not found.", es: "Garaje de devolución no encontrado." },
  "Garagem de retirada não encontrada.": { en: "Pickup garage not found.", es: "Garaje de retiro no encontrado." },
  "O veículo não está alocado nesta garagem.": { en: "The vehicle is not allocated to this garage.", es: "El vehículo no está asignado a este garaje." },
  "O veículo possui uma reserva que impede sua transferência.": {
    en: "The vehicle has a booking that prevents its transfer.",
    es: "El vehículo tiene una reserva que impide su transferencia.",
  },
  "O veículo precisa pertencer ao mesmo locador responsável pela garagem": {
    en: "The vehicle must belong to the same rental company that owns the garage",
    es: "El vehículo debe pertenecer al mismo arrendador responsable del garaje",
  },
  // Expansões de `O local de ${contexto} não está disponível (...)` (reserva.ts).
  "O local de retirada não está disponível (garagem inativa ou em manutenção).": {
    en: "The pickup location is unavailable (garage inactive or under maintenance).",
    es: "El lugar de retiro no está disponible (garaje inactivo o en mantenimiento).",
  },
  "O local de devolução não está disponível (garagem inativa ou em manutenção).": {
    en: "The return location is unavailable (garage inactive or under maintenance).",
    es: "El lugar de devolución no está disponible (garaje inactivo o en mantenimiento).",
  },

  // Veículos / modelos / imagens
  "A lista contém placas duplicadas": { en: "The list contains duplicate plates", es: "La lista contiene placas duplicadas" },
  "Informe ao menos uma placa": { en: "Provide at least one plate", es: "Indique al menos una placa" },
  "Veículo com esta placa já existe": { en: "A vehicle with this plate already exists", es: "Ya existe un vehículo con esta placa" },
  "Veículo não encontrado": { en: "Vehicle not found", es: "Vehículo no encontrado" },
  "Veículo não encontrado.": { en: "Vehicle not found.", es: "Vehículo no encontrado." },
  "Veículo da reserva não encontrado.": { en: "Booking vehicle not found.", es: "Vehículo de la reserva no encontrado." },
  "Veículo ou modelo já existe.": { en: "Vehicle or model already exists.", es: "El vehículo o modelo ya existe." },
  "Modelo de veículo não encontrado.": { en: "Vehicle model not found.", es: "Modelo de vehículo no encontrado." },
  "O modelo precisa pertencer ao mesmo locador do veículo": {
    en: "The model must belong to the same rental company as the vehicle",
    es: "El modelo debe pertenecer al mismo arrendador del vehículo",
  },
  "Nenhum veículo encontrado com os filtros fornecidos": {
    en: "No vehicles found with the given filters",
    es: "No se encontraron vehículos con los filtros proporcionados",
  },
  "Nenhum veículo encontrado para este locador": {
    en: "No vehicles found for this rental company",
    es: "No se encontraron vehículos para este arrendador",
  },
  "Nenhuma localização registrada para este veículo": {
    en: "No location recorded for this vehicle",
    es: "No hay ubicación registrada para este vehículo",
  },
  "Envie o arquivo da imagem": { en: "Send the image file", es: "Envíe el archivo de la imagen" },
  "Imagem inválida": { en: "Invalid image", es: "Imagen inválida" },
  "Imagem não encontrada": { en: "Image not found", es: "Imagen no encontrada" },
  "Imagens duplicadas": { en: "Duplicate images", es: "Imágenes duplicadas" },
  "Imagem marcada para remoção; storage indisponível para concluir": {
    en: "Image marked for removal; storage unavailable to complete it",
    es: "Imagen marcada para eliminación; almacenamiento no disponible para completarla",
  },
  "Limite de imagens do veículo atingido": { en: "Vehicle image limit reached", es: "Se alcanzó el límite de imágenes del vehículo" },
  "Não foi possível persistir a imagem": { en: "Could not save the image", es: "No fue posible guardar la imagen" },
  "Texto alternativo muito longo": { en: "Alternative text is too long", es: "El texto alternativo es demasiado largo" },
  "A ordem deve conter exatamente as imagens prontas do veículo": {
    en: "The order must contain exactly the vehicle's ready images",
    es: "El orden debe contener exactamente las imágenes listas del vehículo",
  },
  // Mensagens de src/infra/media/image-validation.ts repassadas via error.message.
  "Assinatura de imagem PNG inválida.": { en: "Invalid PNG image signature.", es: "Firma de imagen PNG inválida." },
  "Assinatura de imagem JPEG inválida.": { en: "Invalid JPEG image signature.", es: "Firma de imagen JPEG inválida." },
  "Assinatura de imagem WebP inválida.": { en: "Invalid WebP image signature.", es: "Firma de imagen WebP inválida." },
  "Imagem PNG truncada.": { en: "Truncated PNG image.", es: "Imagen PNG truncada." },
  "Imagem JPEG truncada.": { en: "Truncated JPEG image.", es: "Imagen JPEG truncada." },
  "Imagem WebP truncada.": { en: "Truncated WebP image.", es: "Imagen WebP truncada." },
  "Imagem PNG incompleta.": { en: "Incomplete PNG image.", es: "Imagen PNG incompleta." },
  "Imagem JPEG incompleta.": { en: "Incomplete JPEG image.", es: "Imagen JPEG incompleta." },
  "Cabeçalho PNG inválido.": { en: "Invalid PNG header.", es: "Encabezado PNG inválido." },
  "Cabeçalho JPEG inválido.": { en: "Invalid JPEG header.", es: "Encabezado JPEG inválido." },
  "Cabeçalho WebP sem dimensões válidas.": { en: "WebP header has no valid dimensions.", es: "Encabezado WebP sin dimensiones válidas." },
  "Metadados EXIF não são aceitos.": { en: "EXIF metadata is not accepted.", es: "No se aceptan metadatos EXIF." },
  "Tamanho da imagem excede o limite configurado.": { en: "Image size exceeds the configured limit.", es: "El tamaño de la imagen supera el límite configurado." },
  "Formato de imagem não suportado; SVG não é aceito.": {
    en: "Unsupported image format; SVG is not accepted.",
    es: "Formato de imagen no compatible; no se acepta SVG.",
  },
  "Dimensões de imagem inválidas.": { en: "Invalid image dimensions.", es: "Dimensiones de imagen inválidas." },
  "Dimensões da imagem excedem o limite configurado.": {
    en: "Image dimensions exceed the configured limit.",
    es: "Las dimensiones de la imagen superan el límite configurado.",
  },

  // Favoritos / interesse
  "Este veículo já está nos seus favoritos.": { en: "This vehicle is already in your favorites.", es: "Este vehículo ya está en sus favoritos." },
  "Favorito não encontrado": { en: "Favorite not found", es: "Favorito no encontrado" },
  "Inscrição de interesse ativa não encontrada": { en: "Active interest subscription not found", es: "Suscripción de interés activa no encontrada" },
  "Inscrição de interesse não encontrada.": { en: "Interest subscription not found.", es: "Suscripción de interés no encontrada." },
  "Veículo inativo não aceita interesse de disponibilidade": {
    en: "Inactive vehicles do not accept availability interest",
    es: "Un vehículo inactivo no acepta interés de disponibilidad",
  },
  "Você já possui uma inscrição ativa para este veículo.": {
    en: "You already have an active subscription for this vehicle.",
    es: "Ya tiene una suscripción activa para este vehículo.",
  },
  "Você já possui uma inscrição para este veículo.": {
    en: "You already have a subscription for this vehicle.",
    es: "Ya tiene una suscripción para este vehículo.",
  },

  // Reservas
  "A data/hora de início não pode estar no passado.": { en: "The start date/time cannot be in the past.", es: "La fecha/hora de inicio no puede estar en el pasado." },
  "A data/hora de término deve ser posterior à de início.": {
    en: "The end date/time must be after the start.",
    es: "La fecha/hora de finalización debe ser posterior a la de inicio.",
  },
  "A garagem de retirada foi alterada. Revise a reserva antes de confirmar.": {
    en: "The pickup garage has changed. Review the booking before confirming.",
    es: "El garaje de retiro cambió. Revise la reserva antes de confirmar.",
  },
  "A reserva deve ter no mínimo 1 hora.": { en: "The booking must last at least 1 hour.", es: "La reserva debe durar al menos 1 hora." },
  "A reserva não pode exceder 30 dias.": { en: "The booking cannot exceed 30 days.", es: "La reserva no puede superar los 30 días." },
  "Exclusão definitiva de reserva não é permitida. Use POST /api/reserva/:id/cancelar.": {
    en: "Permanent booking deletion is not allowed. Use POST /api/reserva/:id/cancelar.",
    es: "No se permite eliminar definitivamente una reserva. Use POST /api/reserva/:id/cancelar.",
  },
  "Não é possível alterar o período de uma reserva já paga.": {
    en: "The period of an already paid booking cannot be changed.",
    es: "No es posible cambiar el período de una reserva ya pagada.",
  },
  "Nenhuma reserva encontrada com os filtros fornecidos": {
    en: "No bookings found with the given filters",
    es: "No se encontraron reservas con los filtros proporcionados",
  },
  "Nenhuma reserva encontrada para este veículo": { en: "No bookings found for this vehicle", es: "No se encontraron reservas para este vehículo" },
  "O local de devolução deve pertencer ao locador dono do veículo.": {
    en: "The return location must belong to the vehicle's rental company.",
    es: "El lugar de devolución debe pertenecer al arrendador dueño del vehículo.",
  },
  "O local de retirada deve corresponder à garagem onde o veículo está atualmente alocado.": {
    en: "The pickup location must match the garage where the vehicle is currently allocated.",
    es: "El lugar de retiro debe corresponder al garaje donde el vehículo está asignado actualmente.",
  },
  "O veículo já possui uma reserva nesse período.": { en: "The vehicle is already booked for this period.", es: "El vehículo ya tiene una reserva en ese período." },
  "O veículo não está disponível para reserva.": { en: "The vehicle is not available for booking.", es: "El vehículo no está disponible para reservar." },
  "O veículo não possui uma garagem de retirada operacional.": {
    en: "The vehicle has no operational pickup garage.",
    es: "El vehículo no tiene un garaje de retiro operativo.",
  },
  "Reserva cancelada.": { en: "Booking cancelled.", es: "Reserva cancelada." },
  "Reserva em andamento ou concluída não pode ser cancelada.": {
    en: "An ongoing or completed booking cannot be cancelled.",
    es: "Una reserva en curso o finalizada no puede cancelarse.",
  },
  "Reserva já cancelada ou não pode ser cancelada.": {
    en: "Booking already cancelled or cannot be cancelled.",
    es: "La reserva ya fue cancelada o no puede cancelarse.",
  },
  "Reserva já cancelada.": { en: "Booking already cancelled.", es: "La reserva ya fue cancelada." },
  "Reserva já devolvida ou não iniciada.": { en: "Booking already returned or not started.", es: "La reserva ya fue devuelta o no ha comenzado." },
  "Reserva já devolvida.": { en: "Booking already returned.", es: "La reserva ya fue devuelta." },
  "Reserva não encontrada": { en: "Booking not found", es: "Reserva no encontrada" },
  "Reserva não encontrada.": { en: "Booking not found.", es: "Reserva no encontrada." },
  "Reserva não está em andamento.": { en: "Booking is not in progress.", es: "La reserva no está en curso." },
  "Veículo adaptado: o locatário deve possuir uma necessidade especial cadastrada.": {
    en: "Adapted vehicle: the renter must have a registered special need.",
    es: "Vehículo adaptado: el arrendatario debe tener una necesidad especial registrada.",
  },
  "Um ou mais serviços opcionais informados são inválidos ou indisponíveis.": {
    en: "One or more of the optional services provided are invalid or unavailable.",
    es: "Uno o más de los servicios opcionales indicados son inválidos o no están disponibles.",
  },
  "Serviço opcional não encontrado": { en: "Optional service not found", es: "Servicio opcional no encontrado" },
  "Serviço opcional não encontrado.": { en: "Optional service not found.", es: "Servicio opcional no encontrado." },
  "Rastreamento indisponível para esta reserva": { en: "Tracking unavailable for this booking", es: "Seguimiento no disponible para esta reserva" },

  // Condutores
  "Condutor não encontrado nesta reserva.": { en: "Driver not found in this booking.", es: "Conductor no encontrado en esta reserva." },
  "Já existe um condutor com esta CNH nesta reserva.": {
    en: "A driver with this license already exists in this booking.",
    es: "Ya existe un conductor con esta licencia en esta reserva.",
  },
  "Limite de 3 condutores adicionais atingido.": { en: "Limit of 3 additional drivers reached.", es: "Se alcanzó el límite de 3 conductores adicionales." },
  "Não é possível alterar os condutores após o início da reserva.": {
    en: "Drivers cannot be changed after the booking starts.",
    es: "No es posible cambiar los conductores después del inicio de la reserva.",
  },

  // Desbloqueio / devolução
  "Coordenada do dispositivo obrigatória para desbloqueio.": {
    en: "Device coordinates are required to unlock.",
    es: "Las coordenadas del dispositivo son obligatorias para desbloquear.",
  },
  "Código de desbloqueio ainda não gerado. Confirme o pagamento primeiro.": {
    en: "Unlock code not generated yet. Confirm the payment first.",
    es: "El código de desbloqueo aún no se ha generado. Confirme el pago primero.",
  },
  "Código de desbloqueio expirado.": { en: "Unlock code expired.", es: "Código de desbloqueo expirado." },
  "Código de desbloqueio inválido.": { en: "Invalid unlock code.", es: "Código de desbloqueo inválido." },
  "Código de desbloqueio já utilizado ou reserva inválida.": {
    en: "Unlock code already used or invalid booking.",
    es: "Código de desbloqueo ya utilizado o reserva inválida.",
  },
  "Código de desbloqueio já utilizado.": { en: "Unlock code already used.", es: "Código de desbloqueo ya utilizado." },
  "Fora do local permitido para desbloqueio.": { en: "Outside the allowed unlock location.", es: "Fuera del lugar permitido para desbloquear." },
  "Localização de referência do veículo indisponível para desbloqueio.": {
    en: "Vehicle reference location unavailable for unlocking.",
    es: "Ubicación de referencia del vehículo no disponible para desbloquear.",
  },
  "Não foi possível gerar um código de desbloqueio único.": {
    en: "Could not generate a unique unlock code.",
    es: "No fue posible generar un código de desbloqueo único.",
  },
  "O código só pode ser usado a partir da data de início da reserva.": {
    en: "The code can only be used from the booking start date.",
    es: "El código solo puede usarse a partir de la fecha de inicio de la reserva.",
  },
  "QR Code inválido ou adulterado.": { en: "Invalid or tampered QR code.", es: "Código QR inválido o adulterado." },
  "QR Code inválido para esta reserva.": { en: "Invalid QR code for this booking.", es: "Código QR inválido para esta reserva." },
  "Veículo ainda não foi desbloqueado; não há devolução a registrar.": {
    en: "Vehicle has not been unlocked yet; there is no return to record.",
    es: "El vehículo aún no fue desbloqueado; no hay devolución que registrar.",
  },

  // Pagamento / cobrança
  "Cobrança não encontrada": { en: "Charge not found", es: "Cobro no encontrado" },
  "Dados do cartão são obrigatórios para este método de pagamento.": {
    en: "Card details are required for this payment method.",
    es: "Los datos de la tarjeta son obligatorios para este método de pago.",
  },
  "Número de cartão inválido.": { en: "Invalid card number.", es: "Número de tarjeta inválido." },
  "O pagamento desta reserva já foi aprovado.": { en: "Payment for this booking has already been approved.", es: "El pago de esta reserva ya fue aprobado." },
  "Pagamento já está em processamento ou foi aprovado.": {
    en: "Payment is already being processed or was approved.",
    es: "El pago ya está en proceso o fue aprobado.",
  },
  "Pagamento já está em processamento.": { en: "Payment is already being processed.", es: "El pago ya está en proceso." },
  "O prazo de pagamento desta reserva expirou. Faça uma nova reserva.": {
    en: "The payment deadline for this booking has expired. Please make a new booking.",
    es: "El plazo de pago de esta reserva venció. Haga una nueva reserva.",
  },
  "Assinatura do webhook inválida.": { en: "Invalid webhook signature.", es: "Firma del webhook inválida." },
  "Payload de webhook inválido (JSON malformado).": { en: "Invalid webhook payload (malformed JSON).", es: "Payload de webhook inválido (JSON mal formado)." },
  "Payload de webhook inválido.": { en: "Invalid webhook payload.", es: "Payload de webhook inválido." },

  // Avaliações / alertas / notificações / compartilhamento
  "Avaliação não encontrada para esta reserva": { en: "Review not found for this booking", es: "Reseña no encontrada para esta reserva" },
  "Esta reserva já possui uma avaliação.": { en: "This booking already has a review.", es: "Esta reserva ya tiene una reseña." },
  "Só é possível avaliar reservas concluídas (REALIZADA).": {
    en: "Only completed bookings (REALIZADA) can be reviewed.",
    es: "Solo se pueden evaluar reservas finalizadas (REALIZADA).",
  },
  "Alerta não encontrado.": { en: "Alert not found.", es: "Alerta no encontrada." },
  "Notificação não encontrada.": { en: "Notification not found.", es: "Notificación no encontrada." },
  "Compartilhamento não encontrado.": { en: "Share not found.", es: "Enlace compartido no encontrado." },
  "Não foi possível gerar o compartilhamento.": { en: "Could not create the share link.", es: "No fue posible generar el enlace compartido." },
};

// Tradução de uma mensagem de negócio; undefined quando não catalogada.
export function traduzirMensagem(mensagem: string, locale: Locale): string | undefined {
  if (locale === "pt" || !Object.hasOwn(MENSAGENS, mensagem)) return undefined;
  return MENSAGENS[mensagem][locale];
}

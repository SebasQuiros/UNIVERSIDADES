import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

/** Crear un grupo de práctica (Espacio Contador). */
export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  // Empresa de práctica del creador que se une como primer miembro.
  @IsUUID('4')
  companyId: string;
}

/** Unirse a un grupo existente por su código de invitación. */
export class JoinGroupDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  // Empresa de práctica del usuario que se une.
  @IsUUID('4')
  companyId: string;
}

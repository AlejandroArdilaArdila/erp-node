import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard, UsuarioActual, type UsuarioAutenticado } from '@erp/domain/auth';
import { type CategoriaLegado, CategoriasService } from '@erp/domain/productos';

/** Rutas de productos de integrosone. Mantienen las URLs de apipos. */
@ApiTags('Categorias')
@ApiSecurity('DolApiKey')
@Controller('api.php/integrosone/productos')
@UseGuards(ApiKeyGuard)
export class ProductosController {
  constructor(private readonly categorias: CategoriasService) {}

  /** Portado de CategoriaController@getCategorias (apipos). */
  @Get('categorias')
  @ApiOperation({
    summary:
      'Categorias de producto activas del ERP, con el total de productos asociados a cada una',
  })
  @ApiResponse({ status: 200, description: 'Categorias ordenadas por label' })
  @ApiResponse({
    status: 401,
    description: "DOLAPIKEY invalida o el usuario no tiene el permiso 'lire'",
  })
  listarCategorias(@UsuarioActual() usuario: UsuarioAutenticado): Promise<CategoriaLegado[]> {
    return this.categorias.listar(usuario);
  }
}

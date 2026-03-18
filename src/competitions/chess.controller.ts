import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ChessService } from './chess.service';
import { CreateChessRoundDto, UpdateChessRoundDto } from './dto/chess-round.dto';
import { CreateChessMatchDto, UpdateChessMatchDto } from './dto/chess-match.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('competitions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChessController {
  constructor(private readonly chessService: ChessService) {}

  // ==================== RONDAS ====================

  // GET /competitions/chess/rounds?phaseId=X
  @Get('chess/rounds')
  @Public()
  getRoundsByPhase(@Query('phaseId', ParseIntPipe) phaseId: number) {
    return this.chessService.getRoundsByPhase(phaseId);
  }

  // POST /competitions/chess/rounds
  @Post('chess/rounds')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  createRound(@Body() dto: CreateChessRoundDto) {
    return this.chessService.createRound(dto);
  }

  // PATCH /competitions/chess/rounds/:id
  @Patch('chess/rounds/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  updateRound(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateChessRoundDto,
  ) {
    return this.chessService.updateRound(id, dto);
  }

  // DELETE /competitions/chess/rounds/:id
  @Delete('chess/rounds/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  deleteRound(@Param('id', ParseIntPipe) id: number) {
    return this.chessService.deleteRound(id);
  }

  // ==================== MATCHES ====================

  // GET /competitions/chess/rounds/:id/matches
  @Get('chess/rounds/:id/matches')
  @Public()
  getMatchesByRound(@Param('id', ParseIntPipe) id: number) {
    return this.chessService.getMatchesByRound(id);
  }

  // POST /competitions/chess/matches
  @Post('chess/matches')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  createMatch(@Body() dto: CreateChessMatchDto) {
    return this.chessService.createMatch(dto);
  }

  // PATCH /competitions/chess/matches/:id
  @Patch('chess/matches/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  updateMatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateChessMatchDto,
  ) {
    return this.chessService.updateMatch(id, dto);
  }

  // DELETE /competitions/chess/matches/:id
  @Delete('chess/matches/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  deleteMatch(@Param('id', ParseIntPipe) id: number) {
    return this.chessService.deleteMatch(id);
  }

  // ==================== TABLA POR FASE ====================

  // GET /competitions/phases/:phaseId/chess-table
  @Get('phases/:phaseId/chess-table')
  @Public()
  getFullTable(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return this.chessService.getFullTable(phaseId);
  }

  // GET /competitions/phases/:phaseId/chess-standings
  @Get('phases/:phaseId/chess-standings')
  @Public()
  getStandings(@Param('phaseId', ParseIntPipe) phaseId: number) {
    return this.chessService.getStandings(phaseId);
  }
}

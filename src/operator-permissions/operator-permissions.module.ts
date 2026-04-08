import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperatorPermission } from './entities/operator-permission.entity';
import { OperatorPermissionsService } from './operator-permissions.service';
import { OperatorPermissionsController } from './operator-permissions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OperatorPermission])],
  controllers: [OperatorPermissionsController],
  providers: [OperatorPermissionsService],
  exports: [OperatorPermissionsService],
})
export class OperatorPermissionsModule {}
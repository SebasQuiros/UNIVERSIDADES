import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CoursesController, MyCoursesController } from './courses.controller';

@Module({
  providers:   [CoursesService],
  controllers: [CoursesController, MyCoursesController],
  exports:     [CoursesService],
})
export class CoursesModule {}

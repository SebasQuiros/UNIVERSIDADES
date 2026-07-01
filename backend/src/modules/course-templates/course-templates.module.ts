import { Module } from '@nestjs/common';
import { CourseTemplatesService } from './course-templates.service';
import { CourseTemplatesController } from './course-templates.controller';

@Module({
  providers:   [CourseTemplatesService],
  controllers: [CourseTemplatesController],
  exports:     [CourseTemplatesService],
})
export class CourseTemplatesModule {}

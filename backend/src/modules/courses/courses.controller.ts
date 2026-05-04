import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto, UpdateCourseDto, EnrollStudentDto, EnrollBulkDto } from './dto/courses.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { Roles, CurrentUser } from '../auth/decorators/auth.decorators';

@Controller('courses')
@UseGuards(JwtAuthGuard)
export class MyCoursesController {
  constructor(private readonly svc: CoursesService) {}

  @Get('mine')
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  findMine(@CurrentUser() user: any) {
    return this.svc.findMine(user.id);
  }

  @Get(':id')
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  findById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.findById(id, user.id, user.role, user.universityId ?? null);
  }
}

@Controller('universities/:universityId/courses')
@UseGuards(JwtAuthGuard)
export class CoursesController {
  constructor(private readonly svc: CoursesService) {}

  // Data isolation: universityId is always passed to the service, which scopes
  // all queries with { where: { universityId } }. Students can only see courses
  // belonging to the university in the URL — cross-university access is blocked
  // at the DB query level.
  @Get()
  findAll(@Param('universityId') universityId: string) {
    return this.svc.findAll(universityId);
  }

  @Get(':id')
  findOne(
    @Param('universityId') universityId: string,
    @Param('id') id: string,
  ) {
    return this.svc.findOne(universityId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  create(
    @Param('universityId') universityId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateCourseDto,
  ) {
    return this.svc.create(universityId, user.id, dto);
  }

  @Patch(':id')
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  update(
    @Param('universityId') universityId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.svc.update(universityId, id, user.id, user.role, dto);
  }

  @Get(':id/grades')
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  getCourseGrades(
    @Param('universityId') universityId: string,
    @Param('id') id: string,
  ) {
    return this.svc.getCourseGrades(universityId, id);
  }

  @Get(':id/analytics')
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  getCourseAnalytics(
    @Param('universityId') universityId: string,
    @Param('id') id: string,
  ) {
    return this.svc.getCourseAnalytics(universityId, id);
  }

  @Get(':id/students')
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  getStudents(
    @Param('universityId') universityId: string,
    @Param('id') id: string,
  ) {
    return this.svc.getStudentsWithProgress(universityId, id);
  }

  @Delete(':id/students/:studentId')
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  unenroll(
    @Param('universityId') universityId: string,
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.unenroll(universityId, id, studentId, user.id, user.role);
  }

  @Delete(':id')
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  remove(
    @Param('universityId') universityId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.remove(universityId, id, user.id, user.role);
  }

  @Post(':id/enroll')
  @HttpCode(HttpStatus.CREATED)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  enroll(
    @Param('universityId') universityId: string,
    @Param('id') id: string,
    @Body() dto: EnrollStudentDto,
  ) {
    return this.svc.enroll(universityId, id, dto);
  }

  @Post(':id/enroll-bulk')
  @HttpCode(HttpStatus.OK)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  enrollBulk(
    @Param('universityId') universityId: string,
    @Param('id') id: string,
    @Body() dto: EnrollBulkDto,
    @CurrentUser() user: any,
  ) {
    return this.svc.enrollBulk(universityId, id, dto.emails, user.id, user.role);
  }
}

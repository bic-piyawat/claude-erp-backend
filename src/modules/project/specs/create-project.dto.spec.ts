import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProjectDto } from '../dto/create-project.dto';

async function validateDto(payload: unknown) {
  const dto = plainToInstance(CreateProjectDto, payload);
  const errors = await validate(dto);
  return { dto, errors };
}

describe('CreateProjectDto (PRJ-041)', () => {
  it('should accept a 1-200 char trimmed name with no other fields', async () => {
    const { errors } = await validateDto({ name: 'Alpha ERP' });

    expect(errors).toHaveLength(0);
  });

  it('should trim whitespace before length validation', async () => {
    const { dto, errors } = await validateDto({ name: '   Alpha   ' });

    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Alpha');
  });

  it('should reject empty string', async () => {
    const { errors } = await validateDto({ name: '' });

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('minLength');
  });

  it('should reject whitespace-only after trim', async () => {
    const { errors } = await validateDto({ name: '     ' });

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('minLength');
  });

  it('should reject name longer than 200 chars', async () => {
    const { errors } = await validateDto({ name: 'a'.repeat(201) });

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });

  it('should accept name exactly 200 chars', async () => {
    const { errors } = await validateDto({ name: 'a'.repeat(200) });

    expect(errors).toHaveLength(0);
  });
});

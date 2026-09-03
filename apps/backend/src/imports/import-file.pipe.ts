import {
  BadRequestException,
  FileValidator,
  HttpException,
  Injectable,
  ParseFilePipe,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/env';
import { resolveImportFileType } from './file-type';

/**
 * The subset of the multer file object the import pipeline uses. Declared here
 * rather than pulled from the `Express.Multer` global so the service can be
 * unit-tested with a plain object literal.
 */
export interface UploadedImportFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Hard ceiling handed to multer, independent of `MAX_UPLOAD_BYTES`.
 *
 * Multer buffers the whole upload in memory before any pipe runs, so the real
 * (configurable) limit below cannot protect the process on its own — this is
 * the backstop that keeps a 2 GB POST from being read into the heap first.
 */
export const ABSOLUTE_MAX_UPLOAD_BYTES = 32 * 1024 * 1024;

/**
 * `ParseFilePipe` only knows how to raise one status code, but this endpoint
 * owes the client three different ones. Each validator therefore prefixes its
 * message with the status it wants and `importFileException` unpacks it.
 */
const TOO_LARGE = 'too_large::';
const UNSUPPORTED = 'unsupported::';

class ImportFileSizeValidator extends FileValidator<{ maxSize: number }, UploadedImportFile> {
  isValid(file?: UploadedImportFile): boolean {
    if (!file) return false;
    const size = file.size ?? file.buffer?.length ?? 0;
    return size <= this.validationOptions.maxSize;
  }

  buildErrorMessage(): string {
    const megabytes = (this.validationOptions.maxSize / (1024 * 1024)).toFixed(1).replace('.', ',');
    return `${TOO_LARGE}Arquivo maior que o limite de ${megabytes} MB.`;
  }
}

/**
 * Runs the same extension-plus-content check the service runs, so a wrong file
 * is rejected before it is parsed or hashed.
 */
class ImportFileTypeValidator extends FileValidator<Record<string, never>, UploadedImportFile> {
  private reason = 'Formato de arquivo não suportado.';

  isValid(file?: UploadedImportFile): boolean {
    if (!file?.buffer) return false;
    try {
      resolveImportFileType(file.originalname, file.buffer);
      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        const body = error.getResponse();
        const message = typeof body === 'string' ? body : (body as { message?: unknown }).message;
        if (typeof message === 'string') this.reason = message;
      }
      return false;
    }
  }

  buildErrorMessage(): string {
    return `${UNSUPPORTED}${this.reason}`;
  }
}

/** Maps a validator message back onto the status code it asked for. */
export function importFileException(message: string): HttpException {
  if (message.startsWith(TOO_LARGE)) {
    return new PayloadTooLargeException(message.slice(TOO_LARGE.length));
  }
  if (message.startsWith(UNSUPPORTED)) {
    return new UnsupportedMediaTypeException(message.slice(UNSUPPORTED.length));
  }
  // The only remaining case is ParseFilePipe's own "file is required".
  return new BadRequestException('Envie o arquivo no campo "file".');
}

/**
 * Validates the uploaded statement: present, within `MAX_UPLOAD_BYTES`, and of
 * a type whose extension and bytes agree. 400 / 413 / 415 respectively.
 */
@Injectable()
export class ImportFilePipe extends ParseFilePipe {
  constructor(config: ConfigService<EnvConfig, true>) {
    const maxSize = Number(config.get('MAX_UPLOAD_BYTES', { infer: true }) ?? ABSOLUTE_MAX_UPLOAD_BYTES);
    super({
      fileIsRequired: true,
      validators: [new ImportFileSizeValidator({ maxSize }), new ImportFileTypeValidator({} as Record<string, never>)],
      exceptionFactory: importFileException,
    });
  }
}

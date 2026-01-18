import { Injectable, BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

export const imageFileFilter = (req: any, file: any, callback: any) => {
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
    return callback(
      new BadRequestException('Solo se permiten archivos de imagen'),
      false,
    );
  }
  callback(null, true);
};

export const multerConfig = (destination: string) => ({
  storage: diskStorage({
    destination: (req: any, file: any, cb: any) => {
      const uploadPath = `./uploads/${destination}`;
      if (!existsSync(uploadPath)) {
        mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req: any, file: any, cb: any) => {
      const uniqueSuffix = `${uuidv4()}${extname(file.originalname)}`;
      cb(null, uniqueSuffix);
    },
  }),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

@Injectable()
export class UploadService {
  getFileUrl(filename: string, type: 'athletes' | 'institutions' | 'events'): string {
    // Retorna la URL relativa que el frontend puede usar
    return `/uploads/${type}/${filename}`;
  }
}

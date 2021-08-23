import { BinaryToTextEncoding, createHash } from 'crypto';

export class HashService {
    public getHash(input: string, encoding: BinaryToTextEncoding = 'base64'): string {
        return createHash('sha256').update(input).digest(encoding);
    }
}
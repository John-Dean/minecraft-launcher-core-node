import { checksum } from "@xmcl/core";
import { open } from "@xmcl/unzip";
import { createReadStream } from "fs";

export interface Validator {
    /**
     * Validate the download result. It should throw `ValidationError` if validation failed.
     *
     * @param fd The file desciprtor
     * @param destination The result file
     * @param url The url where the file downloaded from
     */
    validate(fd: number, destination: string, url: string): Promise<void>
}

export class ChecksumValidator implements Validator {
    constructor(protected checksum?: ChecksumValidatorOptions) { }

    async validate(fd: number, destination: string, url: string): Promise<void> {
        if (this.checksum) {
            const actual = await checksum(destination, this.checksum.algorithm);
            const expect = this.checksum.hash;
            if (actual !== expect) {
                throw new ChecksumNotMatchError(this.checksum.algorithm, this.checksum.hash, actual, destination, url);
            }
        }
    }
}

export function isValidator(options?: Validator | ChecksumValidatorOptions): options is Validator {
    if (!options) { return false; }
    return "validate" in options && typeof options.validate === "function"
}

export function resolveValidator(options?: ChecksumValidatorOptions | Validator): Validator {
    if (isValidator(options)) { return options; }
    if (options) {
        return new ChecksumValidator({ hash: options.hash, algorithm: options.algorithm })
    }
    return { validate() { return Promise.resolve() } }
}

export interface ChecksumValidatorOptions {
    algorithm: string;
    hash: string;
}

export class ZipValidator implements Validator {
    async validate(fd: number, destination: string, url: string): Promise<void> {
        try {
            const file = await open(fd)
            file.close();
        } catch (e) {
            throw new ValidationError("InvalidZipError", (e as any).message)
        }
    }
}

export class JsonValidator implements Validator {
    validate(fd: number, destination: string, url: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const read = createReadStream(destination, {
                fd,
                autoClose: false,
                emitClose: true,
            });
            let content = ""
            read.on("data", (buf) => {
                content += buf.toString();
            })
            read.on("end", () => {
                try {
                    JSON.parse(content)
                    resolve()
                } catch (e) {
                    reject(e)
                }
            })
        })
    }

}

export class ValidationError extends Error {
    constructor(readonly error: string, message?: string) { super(message); }
}

export class ChecksumNotMatchError extends ValidationError {
    constructor(readonly algorithm: string, readonly expect: string, readonly actual: string, readonly file: string, readonly source?: string) {
        super("ChecksumNotMatchError", source ? `File ${file} (${source}) ${algorithm} checksum not match. Expect: ${expect}. Actual: ${actual}.` : `File ${file} ${algorithm} checksum not match. Expect: ${expect}. Actual: ${actual}.`);
    }
}

export type AppErrorKind =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'unexpected';

export type AppError = {
  type: AppErrorKind;
  message: string;
  fieldErrors?: Record<string, string>;
};

export type AppResult<T> =
  | {
      ok: true;
      value: T;
      data: T;
    }
  | {
      ok: false;
      error: AppError;
    };

export function appSuccess<T>(data: T): AppResult<T> {
  return { ok: true, value: data, data };
}

export function appError(
  kind: AppErrorKind,
  message: string,
  fieldErrors?: Record<string, string>,
): AppResult<never> {
  return {
    ok: false,
    error: {
      type: kind,
      message,
      ...(fieldErrors ? { fieldErrors } : {}),
    },
  };
}

export function unexpectedError(message = 'Something went wrong.') {
  return appError('unexpected', message);
}

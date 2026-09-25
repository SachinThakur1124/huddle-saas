interface ZodFlatError {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
}

function isZodFlatError(value: unknown): value is ZodFlatError {
  return typeof value === "object" && value !== null && ("fieldErrors" in value || "formErrors" in value);
}

/**
 * Surfaces the backend's actual validation message instead of a generic
 * "something went wrong" — the API returns either a plain string (409/401
 * business errors) or a zod `.flatten()` object (400 validation errors).
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "data" in err) {
    const data = (err as { data?: unknown }).data;
    if (typeof data === "object" && data !== null && "error" in data) {
      const error = (data as { error?: unknown }).error;
      if (typeof error === "string") return error;
      if (isZodFlatError(error)) {
        const fieldMessage = Object.values(error.fieldErrors ?? {})
          .flat()
          .filter(Boolean)[0];
        const formMessage = error.formErrors?.[0];
        if (fieldMessage) return fieldMessage;
        if (formMessage) return formMessage;
      }
    }
  }
  if (typeof err === "object" && err !== null && "status" in err && (err as { status: unknown }).status === "FETCH_ERROR") {
    return "Can't reach the server. Check your connection and try again.";
  }
  return fallback;
}

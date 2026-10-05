"use client";

import { useActionState, useRef, useTransition, type FormEvent } from "react";
import type { FormState } from "@/app/orders/actions";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

// React 19 resets a <form action={fn}> after the action finishes, even when it failed validation: everything the user
// typed disappears and they must start again. This hook submits the same way but only clears the form when the action
// succeeded (no error), so a mistake in one field leaves the rest of the form as it was.
export function useActionForm(action: Action, beforeSubmit?: () => boolean) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await action(prev, formData);
    if (!result?.error) formRef.current?.reset();
    return result;
  }, undefined);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (beforeSubmit && !beforeSubmit()) return;
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }
  return { state, pending, onSubmit, formRef };
}

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2Icon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { useTranslation } from "react-i18next"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { errorMessage } from "@/lib/format"

const MIN_LENGTH = 6

export function LoginPage({ setup }: { setup: boolean }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)

  const submit = useMutation({
    mutationFn: () => (setup ? api.setup(password) : api.login(password)),
    onSuccess: () => {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" })
      qc.invalidateQueries({ queryKey: ["auth"] })
    },
    onError: (err) => setError(errorMessage(err, t)),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (setup && password !== confirm) {
      setError(t("auth.mismatch"))
      return
    }
    submit.mutate()
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
        <div className="space-y-3 text-center">
          <Logo className="mx-auto size-11" />
          <h1 className="text-2xl font-semibold tracking-tight">{setup ? t("auth.setupTitle") : t("auth.loginTitle")}</h1>
          <p className="text-sm text-muted-foreground">{setup ? t("auth.setupDescription") : t("auth.loginDescription")}</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              autoFocus
              autoComplete={setup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10"
            />
            {setup && <p className="text-xs text-muted-foreground">{t("auth.passwordHint", { count: MIN_LENGTH })}</p>}
          </div>
          {setup && (
            <div className="space-y-2">
              <Label htmlFor="confirm">{t("auth.confirmPassword")}</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-10"
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            size="lg"
            className="h-10 w-full"
            disabled={submit.isPending || password.length < (setup ? MIN_LENGTH : 1)}
          >
            {submit.isPending && <Loader2Icon className="animate-spin" />}
            {setup ? t("auth.createPassword") : t("auth.signIn")}
          </Button>
        </div>
      </form>
    </div>
  )
}

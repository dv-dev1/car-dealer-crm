"use client";

import { useActionState } from "react";

import { CabecalhoGestao } from "@/components/gestao/CabecalhoGestao";
import type { Role } from "@/shared/db/client";

import { addMemberAction, removeMemberAction, type TeamState } from "./actions";
import type { Member } from "./model";

const ROLE_LABEL: Record<Role, string> = { owner: "Dono", manager: "Gerente", seller: "Vendedor" };
const INITIAL: TeamState = { error: null };

const field = "w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-secondary";
const button = "rounded-[var(--radius-control)] bg-primary px-4 py-2 font-semibold text-surface disabled:opacity-60";
const removeButton =
  "rounded-[var(--radius-control)] border border-danger/30 bg-surface px-3 py-1.5 text-sm text-danger-ink hover:bg-danger-bg disabled:opacity-60";

function AddMemberForm({ role }: { role: Role }) {
  const [state, formAction, pending] = useActionState(addMemberAction, INITIAL);
  // A manager can only invite sellers; the model and the database enforce it too.
  const roles: Role[] = role === "owner" ? ["owner", "manager", "seller"] : ["seller"];

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-[var(--radius)] border border-line bg-surface p-4"
    >
      <h2 className="font-semibold text-secondary">Adicionar pessoa</h2>
      {state.error && <p role="alert">{state.error}</p>}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_10rem_auto] sm:items-end">
        <div className="space-y-1">
          <label htmlFor="team-name" className="block text-secondary">
            Nome
          </label>
          <input id="team-name" name="name" required maxLength={120} autoComplete="off" className={field} />
        </div>
        <div className="space-y-1">
          <label htmlFor="team-email" className="block text-secondary">
            E-mail
          </label>
          <input id="team-email" name="email" type="email" required autoComplete="off" className={field} />
        </div>
        <div className="space-y-1">
          <label htmlFor="team-role" className="block text-secondary">
            Papel
          </label>
          <select id="team-role" name="role" defaultValue="seller" className={field}>
            {roles.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABEL[value]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={pending} className={button}>
          Adicionar
        </button>
      </div>
    </form>
  );
}

function RemoveMemberForm({ member }: { member: Member }) {
  const [state, formAction, pending] = useActionState(removeMemberAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="membershipId" value={member.id} />
      <button type="submit" disabled={pending} aria-label={`Remover ${member.name}`} className={removeButton}>
        Remover
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-danger-ink">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function TeamView({ members, role }: { members: Member[]; role: Role }) {
  const canManage = role === "owner" || role === "manager";

  return (
    <div className="space-y-6">
      <CabecalhoGestao
        eyebrow="Central de gestão"
        titulo="Equipe"
        apoio="Quem tem acesso à Central de Gestão desta loja."
      />

      <ul className="divide-y divide-line rounded-[var(--radius)] border border-line bg-surface">
        {members.map((member) => (
          <li key={member.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-secondary">{member.name}</p>
              <p className="break-all text-sm text-muted-strong">{member.email}</p>
              <p className="mt-1 text-sm text-secondary">
                {ROLE_LABEL[member.role]}
                {!member.linked && <span className="text-muted-strong"> · Aguardando primeiro acesso</span>}
              </p>
            </div>
            {/* A manager only removes sellers; the button would end in an error for the others. */}
            {(role === "owner" || (role === "manager" && member.role === "seller")) && (
              <RemoveMemberForm member={member} />
            )}
          </li>
        ))}
      </ul>

      {canManage && <AddMemberForm role={role} />}
    </div>
  );
}

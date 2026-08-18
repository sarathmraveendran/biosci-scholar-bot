import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDisplayName } from "@/lib/user";

export function UserMenu() {
  const { name, setName, ready } = useDisplayName();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (ready && !name) setOpen(true);
  }, [ready, name]);

  function save() {
    if (!draft.trim()) return;
    setName(draft);
    setDraft("");
    setOpen(false);
  }

  return (
    <>
      {ready && name ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] text-primary uppercase">
                {name.slice(0, 2)}
              </span>
              <span className="hidden max-w-28 truncate sm:inline">{name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="font-normal text-muted-foreground">
              Signed in as {name}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                setDraft(name);
                setOpen(true);
              }}
            >
              Change name
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setName(null)}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <UserRound className="size-4" /> Sign in
        </Button>
      )}

      <Dialog open={open} onOpenChange={(o) => (name ? setOpen(o) : setOpen(true))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Welcome</DialogTitle>
            <DialogDescription>
              No password needed — just tell us what to call you. Your name stays on this device.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="space-y-3"
          >
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Your name"
              maxLength={40}
            />
            <DialogFooter>
              <Button type="submit" disabled={draft.trim().length < 2} className="w-full">
                Continue
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

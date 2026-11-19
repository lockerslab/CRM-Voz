"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Contact } from "@/types";
import Link from "next/link";

type ContactCardProps = {
  contact: Contact;
};

export function ContactCard({ contact }: ContactCardProps) {
  return (
    <Link href={`/contact/${contact.id}`} className="block">
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="space-y-1 p-3 pb-1">
          <CardTitle className="text-sm font-medium leading-tight">
            {contact.name}
          </CardTitle>
          {contact.company ? (
            <p className="text-xs text-muted-foreground">{contact.company}</p>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1 p-3 pt-1">
          {contact.email ? (
            <Badge variant="secondary" className="max-w-full truncate text-[10px]">
              {contact.email}
            </Badge>
          ) : null}
          {contact.phone ? (
            <Badge variant="outline" className="text-[10px]">
              {contact.phone}
            </Badge>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}

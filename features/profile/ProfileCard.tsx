import Image from "next/image";
import { Card } from "@/components/ui/card";
import { User } from "lucide-react";

type ProfileCardProps = {
  profile: SimpleProfile;
};

export function ProfileCard({ profile }: ProfileCardProps) {
  const displayName = profile.fullName || "Not Assigned";
  const displayRole = profile.role
    ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
    : "";

  return (
    <Card
      className={`flex items-center gap-3 p-3 border ${
        profile.role === "professor"
          ? "bg-secondary text-primary"
          : "bg-primary text-white"
      } flex-row`}
    >
      <div
        className={`relative h-12 w-12 flex-shrink-0 rounded-full overflow-hidden ${
          profile.role === "professor" ? "bg-primary" : "bg-muted"
        } flex items-center justify-center`}
      >
        {profile.avatarUrl ? (
          <Image
            src={profile.avatarUrl}
            alt={displayName}
            fill
            className="object-cover"
            sizes="48px"
          />
        ) : (
          <User
            className={`h-6 w-6 ${
              profile.role === "professor"
                ? "text-white"
                : "text-muted-foreground"
            }`}
          />
        )}
      </div>
      <div className="min-w-0">
        {displayRole && <div className="text-sm">{displayRole}</div>}
        <div className="text-sm font-semibold truncate">{displayName}</div>
        {profile.email && (
          <div className="text-xs truncate">{profile.email}</div>
        )}
      </div>
    </Card>
  );
}

import { Suspense } from "react";
import { AttendanceKioskView } from "@/components/attendance/AttendanceKioskView";

export default function StandaloneKioskPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <AttendanceKioskView showBackButton={false} />
    </Suspense>
  );
}

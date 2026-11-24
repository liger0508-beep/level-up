import { Suspense } from "react";
import { AttendanceKioskView } from "@/components/attendance/AttendanceKioskView";

export default function AttendanceKioskPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <AttendanceKioskView showBackButton={true} />
    </Suspense>
  );
}

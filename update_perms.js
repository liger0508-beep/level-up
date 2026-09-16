const fs = require('fs');
const p = 'src/app/(main)/system/permissions/page.tsx';
let d = fs.readFileSync(p, 'utf8');
d = d.replace(/type Role = "admin" \| "coach" \| "athlete" \| "parent";/g, 'type Role = "admin" | "office" | "coach" | "athlete" | "parent";');
d = d.replace(/const roles: \{ key: Role; label: string; color: string; bgColor: string \}... = \[\s+\{ key: "coach"/g, 'const roles: { key: Role; label: string; color: string; bgColor: string }[] = [\n    { key: "office", label: "오피스", color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-500/10" },\n    { key: "coach"');
d = d.replace(/admin: \{ read: true, write: true \},/g, 'office: { read: true, write: true }, admin: { read: true, write: true },');
d = d.replace(/gridTemplateColumns: '2fr 1fr 1fr 1fr'/g, "gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr'");
fs.writeFileSync(p, d, 'utf8');

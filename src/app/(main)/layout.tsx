import { SideNav } from "@/components/layout/SideNav";

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-white dark:bg-zinc-950">
            {/* Left Sidebar Menu */}
            <SideNav />

            {/* Main content area */}
            <div className="flex-1 min-w-0 pb-16 md:pb-0">
                {children}
            </div>
        </div>
    );
}

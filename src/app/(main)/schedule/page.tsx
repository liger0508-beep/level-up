"use client";

import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Plus } from "lucide-react";
import { ScheduleCalendar, ScheduleEvent } from "@/components/schedule/ScheduleCalendar";
import { ScheduleEventDialog } from "@/components/schedule/ScheduleEventDialog";
import { getStoredEvents, saveEvent, updateEvent, deleteEvent } from "@/lib/schedule-sync";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export default function SchedulePage() {
    const [events, setEvents] = useState<ScheduleEvent[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<ScheduleEvent | undefined>();
    const [selectedSlotDate, setSelectedSlotDate] = useState<Date | undefined>();
    const [currentRole, setCurrentRole] = useState<"coach" | "athlete">("coach");
    const [isLoading, setIsLoading] = useState(true);
    const [currentCoachName, setCurrentCoachName] = useState("");

    // Load events from Supabase
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                
                if (user) {
                    const { data: profile } = await supabase
                        .from("users")
                        .select("role, name")
                        .eq("id", user.id)
                        .maybeSingle();

                    if (profile) {
                        setCurrentRole(profile.role === "athlete" || profile.role === "parent" ? "athlete" : "coach");
                        setCurrentCoachName(profile.name || "");
                    }
                }

                const stored = await getStoredEvents();
                setEvents(stored);
            } catch (err) {
                console.error("Failed to load schedule:", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    const refreshEvents = async () => {
        const stored = await getStoredEvents();
        setEvents(stored);
    };

    const handleSelectSlot = (date: Date) => {
        setSelectedSlotDate(date);
    };

    const handleSaveEvent = async (newEvent: Omit<ScheduleEvent, "id">) => {
        if (editingEvent) {
            const updated: ScheduleEvent = { ...newEvent, id: editingEvent.id };
            await updateEvent(updated);
        } else {
            const event: ScheduleEvent = {
                ...newEvent,
                id: crypto.randomUUID(),
            };
            await saveEvent(event);
        }
        setEditingEvent(undefined);
        setIsDialogOpen(false);
        await refreshEvents();
    };

    const handleDeleteEvent = async (id: string) => {
        await deleteEvent(id);
        setEditingEvent(undefined);
        setIsDialogOpen(false);
        await refreshEvents();
    };

    const handleOpenEdit = (event: ScheduleEvent) => {
        setEditingEvent(event);
        setIsDialogOpen(true);
    };

    const handleAddEvent = () => {
        setEditingEvent(undefined);
        setIsDialogOpen(true);
    };

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <CalendarIcon size={24} className="text-brand-navy dark:text-brand-navy-light shrink-0" />
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        Schedule
                    </h1>
                </div>

                {currentRole === "coach" && (
                    <button
                        onClick={handleAddEvent}
                        className="bg-brand-red hover:bg-brand-red-dark text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all flex items-center gap-1"
                    >
                        <Plus className="w-4 h-4" /> 작성
                    </button>
                )}
            </div>

            {isLoading ? (
                <div className="min-h-[400px] flex items-center justify-center">
                    <div className="w-8 h-8 border-3 border-brand-navy border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <>
                    {/* Calendar */}
                    <ScheduleCalendar
                        events={events}
                        onSelectSlot={handleSelectSlot}
                        onSelectEvent={handleOpenEdit}
                        onAddEvent={handleAddEvent}
                        onEditEvent={handleOpenEdit}
                        currentRole={currentRole}
                    />

                    {/* Event Creation/Edit Dialog */}
                    <ScheduleEventDialog
                        isOpen={isDialogOpen}
                        onClose={() => {
                            setIsDialogOpen(false);
                            setEditingEvent(undefined);
                        }}
                        onSave={handleSaveEvent}
                        onDelete={handleDeleteEvent}
                        editEvent={editingEvent}
                        initialDate={selectedSlotDate}
                        currentCoachName={currentCoachName}
                    />
                </>
            )}
        </div>
    );
}

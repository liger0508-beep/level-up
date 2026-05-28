const fs = require('fs');

function patchFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    const importsToAdd = `
import { fetchComments, saveComment, updateComment, deleteComment, AnalysisComment } from "@/lib/analysis-sync";
import { MessageSquare, Send, Paperclip, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
`;
    // Add right after "use client";
    content = content.replace(/"use client";/, '"use client";' + importsToAdd);
    fs.writeFileSync(filePath, content);
}

patchFile('src/app/(main)/community/[id]/page.tsx');
patchFile('src/app/(main)/admin/polls/[id]/page.tsx');

async function run() {
    try {
        const res = await fetch('http://localhost:3000/api/admin/check-sg');
        if (res.ok) {
            const data = await res.json();
            console.log("Success! Data:");
            console.log(JSON.stringify(data, null, 2));
        } else {
            console.log("Failed with status:", res.status);
            const text = await res.text();
            console.log(text);
        }
    } catch (e) {
        console.error("Error fetching API:", e);
    }
}
run();

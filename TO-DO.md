## CORE TO DO
1. Add powersync to sync local encrypted data to supabase database for mobile and web cross platform compatability (users on mobile/web unlock data with the master password, the supabase account system is used to only give the proper user their data. supabase login + sync should be an option to connect in settings AFTER initial app set up locally)

2. get hot key pop up to instantly write words working into ghost chat

## what core AI functionality will instantly help my life:
- the ability for me to yap ANYTHING into it, especially notes/journaling, to automatically save, store and organize for me
- google calendar connection for helping me with my schedule (read and add to it) 
- reminders (can do in app notifcations + telegram for mobile for now then upgrade to mobile app)

## design:
- the AI chat module is the most important core/center of the app
- each module should have their own AI agent that runs with tools that allow a module specific ai agent to interact with the module
- the main AI chat module (ghost) has tools to talk to each ai module via natural language
- module specific AI agents take ghost's commands to ensure accurate and strong output.`
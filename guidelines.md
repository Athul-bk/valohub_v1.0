# ValoHub Brand, UI & Architectural Guidelines (`guidelines.md`)

## 1. Brand Identity & Personality
- **Brand Name**: ValoHub Bike Rental (Kozhikode • Calicut, Kerala)
- **Personality**: Trustworthy, local, adventurous, accessible, and friendly.
- **Voice & Tone**: Professional, warm, and welcoming. Reflects traditional Malabar hospitality with clear, modern transparency (zero hidden fees, free sanitized helmets, 100% instant refund deposits).

---

## 2. Design System & Tokens

### Color Palette:
- **Asphalt Black (`#1A1A1A`)**: Primary grounding color for headers, cards, and text hierarchy.
- **Highway Yellow (`#F59E0B` / `#FFC107`)**: High-visibility accent color for CTA buttons, highlighted tariffs, and key visual anchors.
- **Malabar Green (`#2E8B57` / `#059669`)**: Trust, verification checkmarks, and active status indicators.
- **Off-White / Pearl (`#F8F9FA` / `#F8FAFC`)**: Clean background surface providing breathing room and high legibility.
- **Muted Text (`#64748B` / `#666666`)**: Secondary descriptions and metadata.

### Typography:
- **Headings**: Modern sans-serif (Inter, Montserrat, system-ui), bold geometric hierarchy.
- **Body & Captions**: Crisp sans-serif optimized for mobile readability and fast scanning.

### UI Components:
- **Pill & Rounded Buttons**: `border-radius: 8px` or `border-radius: 9999px` with smooth micro-transitions (`transform 0.15s ease`).
- **Cards**: Subtle elevation (`box-shadow: 0 4px 20px rgba(0,0,0,0.06)`), clean border dividers.

---

## 3. Engineering & Decoupling Standards
1. **Zero Error Target**: Code must be written defensively. Every network call is wrapped in resilient JSON wrappers (`safeJsonFetch`).
2. **CORS & Multi-Host Resilience**: The backend explicitly serves CORS headers (`Access-Control-Allow-Origin: *`) to ensure local development tools (e.g., Live Server on port 5500) and port 3000 work seamlessly.
3. **No Uncaught Rejections**: All API routes use structured `try/catch` blocks returning standardized JSON payloads:
   ```json
   {
     "success": true,
     "message": "Human readable confirmation",
     "data": { ... }
   }
   ```
4. **Data Privacy Guardrails**:
   - Customer data is strictly isolated.
   - Admin dashboards and all bulk database endpoints require Superadmin Bearer token authentication.
# Emergency Medicare Management MCP Server (@manolaz/emergency-medicare-planner-mcp-server)

Emergency Medicare Management Model Context Protocol (MCP) server implementation for interacting with Google Maps and medical services. This emergency medicare management server can find nearby hospitals and clinics within 10km that match specific patient needs.

## Installation & Usage

### Installing via Smithery

To install Emergency Medicare Planner for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@manolaz/emergency-medicare-planner-mcp-server):

```bash
npx -y @smithery/cli install @manolaz/emergency-medicare-planner-mcp-server --client claude
```

### Installing Manually

```bash
# Using npx (recommended)
npx @manolaz/emergency-medicare-planner-mcp-server

# With environment variable for Google Maps API
GOOGLE_MAPS_API_KEY=your_api_key npx @manolaz/emergency-medicare-planner-mcp-server
```

Or install globally:

```bash
# Install globally
npm install -g @manolaz/emergency-medicare-planner-mcp-server

# Run after global installation
GOOGLE_MAPS_API_KEY=your_api_key emergency-medicare-planner-mcp-server
```

## Components

### Tools

- **searchMedicalFacilities**
  - Search for hospitals, clinics, and medical facilities using Google Places API
  - Input:
    - `query` (string): Search query (e.g., "emergency room", "pediatric clinic")
    - `location`: Latitude and longitude of patient location
    - `radius` (optional, default: 10000): Search radius in meters
    - `specialtyNeeded` (optional): Medical specialty required

- **getMedicalFacilityDetails**
  - Get detailed information about a specific medical facility
  - Input:
    - `placeId` (string): Google Place ID of the medical facility
  - Output:
    - Hours of operation, services offered, contact information, etc.

- **calculateRouteToFacility**
  - Calculate fastest route to a medical facility
  - Input:
    - `origin`: Patient's current location
    - `facilityId`: Place ID of the destination facility
    - `transportMode` (optional): Travel mode (driving, walking, transit, ambulance)
    - `avoidTraffic` (optional): Route planning to avoid traffic

- **checkFacilityAvailability**
  - Check if a facility is currently accepting patients
  - Input:
    - `facilityId`: Place ID of the medical facility
    - `emergencyLevel`: Urgency level of the medical situation

## Configuration

### Usage with Claude Desktop

To use this server with the Claude Desktop app, add the following configuration to the "mcpServers" section of your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "emergency-medicare-planner": {
      "command": "npx",
      "args": ["@manolaz/emergency-medicare-planner-mcp-server"],
      "env": {
        "GOOGLE_MAPS_API_KEY": "your_google_maps_api_key"
      }
    }
  }
}
```

Alternatively, you can use the node command directly if you have the package installed:

```json
{
  "mcpServers": {
    "emergency-medicare-planner": {
      "command": "node",
      "args": ["path/to/dist/index.js"],
      "env": {
        "GOOGLE_MAPS_API_KEY": "your_google_maps_api_key"
      }
    }
  }
}
```

## Development

### Building from Source

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the project:

   ```bash
   npm run build
   ```

### Environment Variables

- `GOOGLE_MAPS_API_KEY` (required): Your Google Maps API key with the following APIs enabled:
  - Places API
  - Directions API
  - Geocoding API
  - Time Zone API
  - Distance Matrix API

### Testing

```bash
# Run test suite
npm test

# Run with debug logging
DEBUG=emergency-medicare:* npm start
```

## License

This MCP server is licensed under the MIT License. For more details, please see the LICENSE file in the project repository.

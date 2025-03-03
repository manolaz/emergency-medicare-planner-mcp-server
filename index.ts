#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Client as GoogleMapsClient } from "@googlemaps/google-maps-services-js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
// Add chalk import for formatted output
import chalk from 'chalk';

// Initialize Google Maps client
const googleMapsClient = new GoogleMapsClient({});

// Define ThoughtData interface for sequential thinking
interface ThoughtData {
  thought: string;
  thoughtNumber: number;
  totalThoughts: number;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  branchId?: string;
  needsMoreThoughts?: boolean;
  nextThoughtNeeded: boolean;
}

// Sequential Thinking class implementation
class SequentialThinkingServer {
  private thoughtHistory: ThoughtData[] = [];
  private branches: Record<string, ThoughtData[]> = {};

  private validateThoughtData(input: unknown): ThoughtData {
    const data = input as Record<string, unknown>;

    if (!data.thought || typeof data.thought !== 'string') {
      throw new Error('Invalid thought: must be a string');
    }
    if (!data.thoughtNumber || typeof data.thoughtNumber !== 'number') {
      throw new Error('Invalid thoughtNumber: must be a number');
    }
    if (!data.totalThoughts || typeof data.totalThoughts !== 'number') {
      throw new Error('Invalid totalThoughts: must be a number');
    }
    if (typeof data.nextThoughtNeeded !== 'boolean') {
      throw new Error('Invalid nextThoughtNeeded: must be a boolean');
    }

    return {
      thought: data.thought,
      thoughtNumber: data.thoughtNumber,
      totalThoughts: data.totalThoughts,
      nextThoughtNeeded: data.nextThoughtNeeded,
      isRevision: data.isRevision as boolean | undefined,
      revisesThought: data.revisesThought as number | undefined,
      branchFromThought: data.branchFromThought as number | undefined,
      branchId: data.branchId as string | undefined,
      needsMoreThoughts: data.needsMoreThoughts as boolean | undefined,
    };
  }

  private formatThought(thoughtData: ThoughtData): string {
    const { thoughtNumber, totalThoughts, thought, isRevision, revisesThought, branchFromThought, branchId } = thoughtData;

    let prefix = '';
    let context = '';

    if (isRevision) {
      prefix = chalk.yellow('🔄 Revision');
      context = ` (revising thought ${revisesThought})`;
    } else if (branchFromThought) {
      prefix = chalk.green('🌿 Branch');
      context = ` (from thought ${branchFromThought}, ID: ${branchId})`;
    } else {
      prefix = chalk.blue('💭 Thought');
      context = '';
    }

    const header = `${prefix} ${thoughtNumber}/${totalThoughts}${context}`;
    const border = '─'.repeat(Math.max(header.length, thought.length) + 4);

    return `
┌${border}┐
│ ${header} │
├${border}┤
│ ${thought.padEnd(border.length - 2)} │
└${border}┘`;
  }

  public processThought(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      const validatedInput = this.validateThoughtData(input);

      if (validatedInput.thoughtNumber > validatedInput.totalThoughts) {
        validatedInput.totalThoughts = validatedInput.thoughtNumber;
      }

      this.thoughtHistory.push(validatedInput);

      if (validatedInput.branchFromThought && validatedInput.branchId) {
        if (!this.branches[validatedInput.branchId]) {
          this.branches[validatedInput.branchId] = [];
        }
        this.branches[validatedInput.branchId].push(validatedInput);
      }

      const formattedThought = this.formatThought(validatedInput);
      console.error(formattedThought);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            thoughtNumber: validatedInput.thoughtNumber,
            totalThoughts: validatedInput.totalThoughts,
            nextThoughtNeeded: validatedInput.nextThoughtNeeded,
            branches: Object.keys(this.branches),
            thoughtHistoryLength: this.thoughtHistory.length
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            status: 'failed'
          }, null, 2)
        }],
        isError: true
      };
    }
  }
}

// Define the sequential thinking tool
const SEQUENTIAL_THINKING_TOOL: Tool = {
  name: "sequentialthinking",
  description: `A detailed tool for dynamic and reflective medical problem-solving through thoughts.
This tool helps analyze medical problems through a flexible thinking process that can adapt and evolve.
Each thought can build on, question, or revise previous insights as understanding of the medical situation deepens.

When to use this tool:
- Breaking down complex medical problems into steps
- Planning and designing treatment approaches with room for revision
- Clinical analysis that might need course correction
- Medical problems where the full scope might not be clear initially
- Healthcare decisions that require a multi-step solution
- Medical evaluations that need to maintain context over multiple steps
- Situations where irrelevant medical information needs to be filtered out

Key features:
- You can adjust total_thoughts up or down as the diagnosis progresses
- You can question or revise previous medical assessments
- You can add more diagnostic thoughts as new information emerges
- You can express clinical uncertainty and explore alternative approaches
- Not every medical assessment needs to build linearly - you can branch or backtrack
- Generates a clinical hypothesis
- Verifies the hypothesis based on the Chain of Thought steps
- Repeats the process until a satisfactory diagnosis or treatment plan is reached
- Provides a correct medical assessment or recommendation`,
  inputSchema: {
    type: "object",
    properties: {
      thought: {
        type: "string",
        description: "Your current clinical thinking step"
      },
      nextThoughtNeeded: {
        type: "boolean",
        description: "Whether another medical assessment step is needed"
      },
      thoughtNumber: {
        type: "integer",
        description: "Current thought number",
        minimum: 1
      },
      totalThoughts: {
        type: "integer",
        description: "Estimated total thoughts needed for complete evaluation",
        minimum: 1
      },
      isRevision: {
        type: "boolean",
        description: "Whether this revises previous medical thinking"
      },
      revisesThought: {
        type: "integer",
        description: "Which medical assessment is being reconsidered",
        minimum: 1
      },
      branchFromThought: {
        type: "integer",
        description: "Branching point thought number for alternative diagnosis",
        minimum: 1
      },
      branchId: {
        type: "string",
        description: "Branch identifier for the diagnostic path"
      },
      needsMoreThoughts: {
        type: "boolean",
        description: "If more clinical evaluation is needed"
      }
    },
    required: ["thought", "nextThoughtNeeded", "thoughtNumber", "totalThoughts"]
  }
};

// Initialize the thinking server
const thinkingServer = new SequentialThinkingServer();

// Schema definitions
const FindNearbyMedicalFacilitiesSchema = z.object({
  userLocation: z.string().describe("User's current location (address or coordinates)"),
  radius: z.number().default(10000).describe("Search radius in meters (default: 10000m = 10km)"),
  treatmentNeeds: z.array(z.string()).optional().describe("Specific medical treatments or services needed"),
  careQuality: z.enum(["high", "medium", "any"]).optional().describe("Expected quality of medical care"),
  priceRange: z.enum(["low", "moderate", "high", "any"]).optional().describe("Price range preference"),
  facilities: z.array(z.enum(["hospital", "clinic", "emergency", "pharmacy", "specialist"])).optional()
    .describe("Types of medical facilities to search for"),
  infrastructure: z.enum(["excellent", "good", "any"]).optional().describe("Quality of infrastructure and cleanliness"),
});

const CheckMedicareCoverageSchema = z.object({
  treatmentCode: z.string().describe("Medicare treatment or procedure code"),
  state: z.string().describe("US State code (e.g., CA, NY)"),
  insuranceType: z.string().optional().describe("Type of Medicare insurance (e.g., Part A, Part B)"),
});

const GetEmergencyContactsSchema = z.object({
  location: z.string().describe("Location to get emergency contacts for"),
  serviceType: z.array(z.string()).optional().describe("Types of emergency services needed"),
});

const ScheduleEmergencyTransportSchema = z.object({
  patientLocation: z.string().describe("Patient's current location"),
  destination: z.string().optional().describe("Destination hospital or clinic"),
  medicalCondition: z.string().describe("Brief description of medical condition"),
  urgency: z.enum(["critical", "urgent", "standard"]).describe("Level of urgency"),
});

// Server implementation
const server = new Server(
  {
    name: "emergency-medicare-planner",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "find_nearby_medical_facilities",
      description: "Finds hospitals and clinics nearby user location that match specific requirements",
      inputSchema: zodToJsonSchema(FindNearbyMedicalFacilitiesSchema),
    },
    {
      name: "check_medicare_coverage",
      description: "Checks what treatments and procedures are covered by Medicare",
      inputSchema: zodToJsonSchema(CheckMedicareCoverageSchema),
    },
    {
      name: "get_emergency_contacts",
      description: "Retrieves emergency contact information for a specific location",
      inputSchema: zodToJsonSchema(GetEmergencyContactsSchema),
    },
    {
      name: "schedule_emergency_transport",
      description: "Arranges emergency medical transportation",
      inputSchema: zodToJsonSchema(ScheduleEmergencyTransportSchema),
    },
    // Add the sequential thinking tool
    SEQUENTIAL_THINKING_TOOL,
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Handle sequential thinking tool
    if (name === "sequentialthinking") {
      return thinkingServer.processThought(args);
    }
    
    switch (name) {
      case "find_nearby_medical_facilities": {
        const validatedArgs = FindNearbyMedicalFacilitiesSchema.parse(args);
        
        // Mock implementation - in a real scenario this would call the Google Maps API
        const mockFacilities = [
          {
            name: "General Hospital",
            address: "123 Main St, Cityville",
            distance: "2.3 km",
            type: "hospital",
            treatmentsAvailable: ["emergency", "surgery", "cardiology"],
            careQuality: "high",
            priceRange: "moderate",
            infrastructure: "excellent"
          },
          {
            name: "Community Clinic",
            address: "456 Oak Ave, Cityville",
            distance: "3.8 km",
            type: "clinic",
            treatmentsAvailable: ["general practice", "pediatrics"],
            careQuality: "medium",
            priceRange: "low",
            infrastructure: "good"
          },
          {
            name: "Specialized Medical Center",
            address: "789 Pine St, Cityville",
            distance: "5.1 km",
            type: "specialist",
            treatmentsAvailable: ["oncology", "neurology"],
            careQuality: "high",
            priceRange: "high",
            infrastructure: "excellent"
          }
        ];
        
        // Filter facilities based on user criteria
        let facilities = mockFacilities;
        
        // Filter by treatment needs if specified
        if (validatedArgs.treatmentNeeds && validatedArgs.treatmentNeeds.length > 0) {
          facilities = facilities.filter(facility => 
            validatedArgs.treatmentNeeds!.some(treatment => 
              facility.treatmentsAvailable.includes(treatment)
            )
          );
        }
        
        // Filter by care quality if specified
        if (validatedArgs.careQuality && validatedArgs.careQuality !== "any") {
          facilities = facilities.filter(facility => 
            facility.careQuality === validatedArgs.careQuality ||
            (validatedArgs.careQuality === "high" && facility.careQuality === "high") ||
            (validatedArgs.careQuality === "medium" && ["medium", "high"].includes(facility.careQuality))
          );
        }
        
        // Filter by price range if specified
        if (validatedArgs.priceRange && validatedArgs.priceRange !== "any") {
          facilities = facilities.filter(facility => facility.priceRange === validatedArgs.priceRange);
        }
        
        // Filter by facility type if specified
        if (validatedArgs.facilities && validatedArgs.facilities.length > 0) {
          facilities = facilities.filter(facility => 
            validatedArgs.facilities!.includes(facility.type as any)
          );
        }
        
        // Filter by infrastructure quality if specified
        if (validatedArgs.infrastructure && validatedArgs.infrastructure !== "any") {
          facilities = facilities.filter(facility => 
            facility.infrastructure === validatedArgs.infrastructure ||
            (validatedArgs.infrastructure === "good" && ["good", "excellent"].includes(facility.infrastructure))
          );
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Found ${facilities.length} medical facilities near ${validatedArgs.userLocation} within ${validatedArgs.radius/1000} km:\n\n` +
                    facilities.map(f => 
                      `- ${f.name} (${f.type})\n  Address: ${f.address}\n  Distance: ${f.distance}\n` +
                      `  Treatments: ${f.treatmentsAvailable.join(", ")}\n` +
                      `  Quality: ${f.careQuality}, Price: ${f.priceRange}, Infrastructure: ${f.infrastructure}`
                    ).join("\n\n")
            },
          ],
        };
      }

      case "check_medicare_coverage": {
        const validatedArgs = CheckMedicareCoverageSchema.parse(args);
        // Mock implementation - would connect to Medicare database in real implementation
        return {
          content: [
            {
              type: "text",
              text: `Medicare coverage for ${validatedArgs.treatmentCode} in ${validatedArgs.state}:\n` +
                    `Coverage Type: ${validatedArgs.insuranceType || "Standard"}\n` +
                    `Coverage Status: Covered\n` +
                    `Co-pay: $25\n` +
                    `Deductible: Applies\n` +
                    `Special Requirements: Prior authorization needed`,
            },
          ],
        };
      }

      case "get_emergency_contacts": {
        const validatedArgs = GetEmergencyContactsSchema.parse(args);
        return {
          content: [
            {
              type: "text",
              text: `Emergency contacts for ${validatedArgs.location}:\n` +
                    `Emergency Services: 911\n` +
                    `Nearest Hospital: General Hospital - (555) 123-4567\n` +
                    `Poison Control: (800) 222-1222\n` +
                    `Medicare Hotline: 1-800-MEDICARE`,
            },
          ],
        };
      }

      case "schedule_emergency_transport": {
        const validatedArgs = ScheduleEmergencyTransportSchema.parse(args);
        return {
          content: [
            {
              type: "text",
              text: `Emergency transport scheduled from ${validatedArgs.patientLocation}\n` +
                    `${validatedArgs.destination ? `To: ${validatedArgs.destination}\n` : ''}` +
                    `Urgency: ${validatedArgs.urgency}\n` +
                    `Condition: ${validatedArgs.medicalCondition}\n` +
                    `ETA: 12 minutes\n` +
                    `Transport ID: EMT-${Math.floor(Math.random() * 10000)}\n` +
                    `Please stand by and keep patient stable.`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Emergency Medicare Planner MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
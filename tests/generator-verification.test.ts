import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity VM environment
const mockClarity = {
  tx: {
    sender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    sponsoredBy: null,
  },
  contracts: {
    'generator-verification': {
      functions: {
        'register-generator': vi.fn(),
        'verify-generator': vi.fn(),
        'reject-generator': vi.fn(),
        'get-generator': vi.fn(),
        'is-verified': vi.fn(),
        'transfer-admin': vi.fn(),
      },
      variables: {
        admin: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
        'next-generator-id': 1,
      },
      maps: {
        generators: new Map(),
      },
    },
  },
};

// Mock the contract calls
vi.mock('clarity-vm', () => ({
  callReadOnlyFunction: vi.fn((contractName, functionName, args) => {
    if (contractName === 'generator-verification') {
      if (functionName === 'get-generator') {
        const generatorId = args[0];
        return mockClarity.contracts['generator-verification'].maps.generators.get(generatorId) || null;
      }
      if (functionName === 'is-verified') {
        const generatorId = args[0];
        const generator = mockClarity.contracts['generator-verification'].maps.generators.get(generatorId);
        return generator ? generator.status === 1 : false;
      }
    }
    return null;
  }),
  callPublicFunction: vi.fn((contractName, functionName, args, sender) => {
    if (contractName === 'generator-verification') {
      if (functionName === 'register-generator') {
        const [name, location, capacityKw, technologyType] = args;
        const generatorId = mockClarity.contracts['generator-verification'].variables['next-generator-id'];
        
        mockClarity.contracts['generator-verification'].maps.generators.set(generatorId, {
          owner: sender,
          name,
          location,
          'capacity-kw': capacityKw,
          'technology-type': technologyType,
          status: 0,
          'verification-date': 0,
        });
        
        mockClarity.contracts['generator-verification'].variables['next-generator-id'] += 1;
        return { success: true, value: generatorId };
      }
      
      if (functionName === 'verify-generator') {
        const generatorId = args[0];
        const generator = mockClarity.contracts['generator-verification'].maps.generators.get(generatorId);
        
        if (!generator) {
          return { success: false, error: 'Generator not found' };
        }
        
        if (sender !== mockClarity.contracts['generator-verification'].variables.admin) {
          return { success: false, error: 'Not authorized' };
        }
        
        if (generator.status !== 0) {
          return { success: false, error: 'Generator not in pending status' };
        }
        
        generator.status = 1;
        generator['verification-date'] = 100; // Mock block height
        mockClarity.contracts['generator-verification'].maps.generators.set(generatorId, generator);
        
        return { success: true };
      }
    }
    return { success: false, error: 'Function not implemented in mock' };
  }),
}));

describe('Generator Verification Contract', () => {
  beforeEach(() => {
    // Reset the mock state
    mockClarity.contracts['generator-verification'].maps.generators = new Map();
    mockClarity.contracts['generator-verification'].variables['next-generator-id'] = 1;
  });
  
  it('should register a new generator', async () => {
    const result = await mockClarity.contracts['generator-verification'].functions['register-generator'](
        'Solar Farm Alpha',
        'California, USA',
        5000,
        'Solar PV'
    );
    
    expect(result.success).toBe(true);
    expect(result.value).toBe(1);
    
    const generator = mockClarity.contracts['generator-verification'].maps.generators.get(1);
    expect(generator).toBeDefined();
    expect(generator.name).toBe('Solar Farm Alpha');
    expect(generator.status).toBe(0); // Pending
  });
  
  it('should verify a generator', async () => {
    // First register a generator
    await mockClarity.contracts['generator-verification'].functions['register-generator'](
        'Wind Farm Beta',
        'Texas, USA',
        10000,
        'Wind'
    );
    
    // Then verify it
    const result = await mockClarity.contracts['generator-verification'].functions['verify-generator'](1);
    
    expect(result.success).toBe(true);
    
    const generator = mockClarity.contracts['generator-verification'].maps.generators.get(1);
    expect(generator.status).toBe(1); // Verified
    expect(generator['verification-date']).toBe(100); // Mock block height
  });
  
  it('should not allow non-admin to verify a generator', async () => {
    // First register a generator
    await mockClarity.contracts['generator-verification'].functions['register-generator'](
        'Hydro Plant Gamma',
        'Washington, USA',
        8000,
        'Hydro'
    );
    
    // Try to verify with a different sender
    mockClarity.tx.sender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    
    const result = await mockClarity.contracts['generator-verification'].functions['verify-generator'](1);
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authorized');
    
    // Reset sender
    mockClarity.tx.sender = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
  });
});

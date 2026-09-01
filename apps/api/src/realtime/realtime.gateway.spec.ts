import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';

/**
 * The viewer count is not just a log line — it decides whether the ops simulator
 * writes to the database at all. A socket that fails the handshake must not
 * count, or an unauthenticated scanner hitting the endpoint would be enough to
 * start generating traffic.
 */
type SocketLike = Parameters<RealtimeGateway['handleConnection']>[0];

function socket(id: string, token?: string): SocketLike {
  return {
    id,
    handshake: { auth: token ? { token } : {}, headers: {} },
    emit: jest.fn(),
    disconnect: jest.fn(),
  } as unknown as SocketLike;
}

describe('RealtimeGateway viewer tracking', () => {
  let gateway: RealtimeGateway;
  let verify: jest.Mock;

  beforeEach(() => {
    verify = jest.fn().mockResolvedValue({ sub: 'u1' });
    const jwt = { verifyAsync: verify } as unknown as JwtService;
    const config = { getOrThrow: () => 'test-secret' } as unknown as ConfigService;
    gateway = new RealtimeGateway(jwt, config);
  });

  it('starts with no viewers', () => {
    expect(gateway.viewerCount).toBe(0);
    expect(gateway.hasViewers()).toBe(false);
  });

  it('counts an authenticated socket', async () => {
    await gateway.handleConnection(socket('a', 'good-token'));
    expect(gateway.viewerCount).toBe(1);
    expect(gateway.hasViewers()).toBe(true);
  });

  it('does not count a socket with no token', async () => {
    await gateway.handleConnection(socket('a'));
    expect(gateway.viewerCount).toBe(0);
  });

  it('does not count a socket whose token fails verification', async () => {
    verify.mockRejectedValueOnce(new Error('invalid'));
    await gateway.handleConnection(socket('a', 'bad-token'));
    expect(gateway.viewerCount).toBe(0);
  });

  it('drops the count when a viewer disconnects', async () => {
    await gateway.handleConnection(socket('a', 'good-token'));
    await gateway.handleConnection(socket('b', 'good-token'));
    expect(gateway.viewerCount).toBe(2);

    gateway.handleDisconnect(socket('a'));
    expect(gateway.viewerCount).toBe(1);
    expect(gateway.hasViewers()).toBe(true);

    gateway.handleDisconnect(socket('b'));
    expect(gateway.hasViewers()).toBe(false);
  });

  it('ignores a disconnect for a socket that never authenticated', async () => {
    await gateway.handleConnection(socket('a', 'good-token'));
    gateway.handleDisconnect(socket('never-connected'));
    expect(gateway.viewerCount).toBe(1);
  });
});

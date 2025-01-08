import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { main } from './blog';

const TEST_BLOG_URL = 'https://test.weblog.lol/feed.json';

// Capture console output
const mockConsoleError = vi.spyOn(console, 'error');
const mockConsoleLog = vi.spyOn(console, 'log');

// Mock process.exit
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

// Setup MSW server for mocking HTTP requests
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  server.resetHandlers();
  mockConsoleError.mockReset();
  mockConsoleLog.mockReset();
  mockExit.mockReset();
});

afterAll(() => server.close());

describe('countPosts', () => {
  it('should correctly count posts from valid JSON', async () => {
    server.use(
      http.get(TEST_BLOG_URL, () => {
        return HttpResponse.json({
          version: "https://jsonfeed.org/version/1.1",
          title: "Test Blog",
          items: [
            { id: "1", title: "Post 1" },
            { id: "2", title: "Post 2" }
          ]
        });
      })
    );

    await main(TEST_BLOG_URL, 'count');

    expect(mockConsoleLog).toHaveBeenCalledWith(2);
    expect(mockConsoleError).not.toHaveBeenCalled();
    expect(mockExit).not.toHaveBeenCalled();
  });

  it('should handle invalid JSON structure', async () => {
    server.use(
      http.get(TEST_BLOG_URL, () => {
        return HttpResponse.json({
          version: "https://jsonfeed.org/version/1.1",
          title: "Test Blog"
          // Missing 'items' array
        });
      })
    );

    await main(TEST_BLOG_URL, 'count');

    expect(mockConsoleLog).not.toHaveBeenCalled();
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Error:',
      'Failed to fetch blog posts: Invalid response format'
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should handle network errors', async () => {
    server.use(
      http.get(TEST_BLOG_URL, () => {
        return new HttpResponse(
          JSON.stringify({ error: 'Internal Server Error' }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      })
    );

    await main(TEST_BLOG_URL, 'count');

    expect(mockConsoleLog).not.toHaveBeenCalled();
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Error:',
      'Failed to fetch blog posts: Server returned 500'
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should use BLOG_FEED_URL environment variable when no URL provided', async () => {
    process.env.BLOG_FEED_URL = TEST_BLOG_URL;

    server.use(
      http.get(TEST_BLOG_URL, () => {
        return HttpResponse.json({
          version: "https://jsonfeed.org/version/1.1",
          title: "Test Blog",
          items: [{ id: "1", title: "Post 1" }]
        });
      })
    );

    await main(undefined, 'count');

    expect(mockConsoleLog).toHaveBeenCalledWith(1);
    expect(mockConsoleError).not.toHaveBeenCalled();
    expect(mockExit).not.toHaveBeenCalled();

    delete process.env.BLOG_FEED_URL;
  });

  it('should error when no URL is provided and BLOG_FEED_URL is not set', async () => {
    delete process.env.BLOG_FEED_URL;

    await main(undefined, 'count');

    expect(mockConsoleLog).not.toHaveBeenCalled();
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Error:',
      'Blog feed URL not provided'
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});

// Add a new test for unknown commands
it('should handle unknown commands', async () => {
  await main(TEST_BLOG_URL, 'invalid-command');

  expect(mockConsoleLog).not.toHaveBeenCalled();
  expect(mockConsoleError).toHaveBeenCalledWith(
    'Error:',
    'Unknown blog command: invalid-command'
  );
  expect(mockExit).toHaveBeenCalledWith(1);
});

it('should error when no command is provided', async () => {
  await main(TEST_BLOG_URL, undefined);

  expect(mockConsoleLog).not.toHaveBeenCalled();
  expect(mockConsoleError).toHaveBeenCalledWith(
    'Error:',
    'Unknown blog command: undefined'
  );
  expect(mockExit).toHaveBeenCalledWith(1);
});

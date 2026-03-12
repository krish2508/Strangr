from collections import deque

class MatchmakingQueue:

    def __init__(self):
        self.queue = deque()

    def add_user(self, user):
        self.queue.append(user)

    def remove_user(self, user):
        if user in self.queue:
            self.queue.remove(user)

    def match_users(self):

        if len(self.queue) >= 2:

            user1 = self.queue.popleft()
            user2 = self.queue.popleft()

            return user1, user2

        return None, None


matchmaker = MatchmakingQueue()
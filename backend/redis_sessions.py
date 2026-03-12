from redis_service import redis_client

SESSION_PREFIX = "session:"


def create_session(user1, user2):

    redis_client.set(SESSION_PREFIX + user1, user2)
    redis_client.set(SESSION_PREFIX + user2, user1)


def get_partner(user):

    return redis_client.get(SESSION_PREFIX + user)


def remove_session(user):

    partner = redis_client.get(SESSION_PREFIX + user)

    if partner:

        redis_client.delete(SESSION_PREFIX + user)
        redis_client.delete(SESSION_PREFIX + partner)

    return partner
import { Hono } from 'hono'
import userRoute from '@/route/userRoute'
import { dbClientMiddleWare } from '@/middleware/postgresMiddleware';
import { redisMiddleware } from '@/middleware/redisMiddleware';

const app = new Hono()

app.use(dbClientMiddleWare);
app.use(redisMiddleware);

app.route('/users', userRoute)

app.onError((err, c) => {
    console.error(`Error: ${err.message}`)
    return c.json({ error: 'Internal Server Error' }, 500)
})

export default app
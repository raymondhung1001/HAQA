import { Hono } from 'hono'
import userRoute from '@/route/userRoute'
import { dbClientMiddleWare } from '@/middleware/dbMiddleware';

const app = new Hono()

app.use(dbClientMiddleWare);

app.route('/users', userRoute)

app.onError((err, c) => {
    console.error(`Error: ${err.message}`)
    return c.json({ error: 'Internal Server Error' }, 500)
})

export default app
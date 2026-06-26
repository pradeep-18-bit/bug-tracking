pipeline {
    agent any

    stages {
        stage('Deploy Bug Tracker') {
            steps {
                sh '''
                ssh bugtracker 'bash -s' <<'REMOTE_DEPLOY'
                    set -e

                    cd /home/ubuntu/bug-tracking
                    git checkout dev2
                    git fetch origin
                    git reset --hard origin/dev2

                    docker compose down
                    docker compose build --no-cache
                    docker compose up -d --force-recreate

                    FRONTEND_PORT=$(grep -E '^FRONTEND_PORT=' .env | tail -n 1 | cut -d= -f2)
                    FRONTEND_PORT=${FRONTEND_PORT:-3000}

                    for attempt in $(seq 1 30); do
                        if curl -fsS "http://localhost:${FRONTEND_PORT}/api/health"; then
                            exit 0
                        fi

                        echo "Waiting for API health check... ${attempt}/30"
                        sleep 5
                    done

                    docker compose ps
                    docker compose logs --tail=120 backend
                    exit 1
REMOTE_DEPLOY
                '''
            }
        }
    }
}

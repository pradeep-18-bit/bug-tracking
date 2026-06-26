pipeline {
    agent any

    stages {
        stage('Deploy Bug Tracker') {
            steps {
                sh '''
                ssh bugtracker "
                    cd /home/ubuntu/bug-tracking &&
                    git checkout dev2 &&
                    git fetch origin &&
                    git reset --hard origin/dev2 &&
                    docker compose down &&
                    docker compose build --no-cache &&
                    docker compose up -d --force-recreate
                "
                '''
            }
        }
    }
}
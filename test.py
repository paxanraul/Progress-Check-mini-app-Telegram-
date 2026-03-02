class Account:
    def __init__(self, owner, balance):
        self.owner = owner
        self.balance = balance
    def deposit(self, amount):
        self.balance += amount
    def withdraw(self, amount):
        if amount <= self.balance:
            self.balance -= amount
        else:
            print("Недостаточно денег.. sosi")
    def info(self):
        print(f"Владелец: {self.owner}\nБаланс: {self.balance}")

a = Account("Raul4ik", 5000)
a.withdraw(1000)
a.deposit(2000)
a.info()
